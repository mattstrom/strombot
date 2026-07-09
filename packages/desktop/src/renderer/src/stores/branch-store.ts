import type { BranchKind, BranchSummary } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

import type { RootStore } from './root-store';

export interface BranchSelectorState {
	parentThreadId: string;
	forkVisibleIndex: number;
	// 0 = the parent's own continuation; 1..total-1 = branches in creation order.
	current: number;
	total: number;
}

function selectionKey(parentThreadId: string, forkVisibleIndex: number): string {
	return `${parentThreadId}:${forkVisibleIndex}`;
}

export class BranchStore {
	// Message index currently being edited in the displayed transcript.
	editingIndex: number | undefined = undefined;
	editDraft = '';

	private familiesByRoot = new Map<string, BranchSummary[]>();
	// rootId -> "parentThreadId:forkVisibleIndex" -> selected option (0 = parent continuation).
	private selections = new Map<string, Map<string, number>>();

	constructor(private readonly root: RootStore) {
		makeAutoObservable(this);
	}

	family(rootId: string): BranchSummary[] {
		return this.familiesByRoot.get(rootId) ?? [];
	}

	// The thread whose messages are displayed: walk from the root, descending into
	// the selected branch at the first diverging sibling group of each thread.
	leafFor(rootId: string): string {
		return this.walk(rootId).leafId;
	}

	// Sibling selectors along the displayed path, keyed by visible message index.
	// An index equal to the transcript length is valid: a fresh fork has no tail yet.
	selectorsFor(rootId: string): Map<number, BranchSelectorState> {
		return this.walk(rootId).selectors;
	}

	async load(rootId: string): Promise<void> {
		const branches = await window.api.branches.list(rootId);
		runInAction(() => {
			this.familiesByRoot.set(rootId, branches);
		});
		await this.root.chat.ensureMessages(this.leafFor(rootId));
	}

	async selectSibling(visibleIndex: number, delta: number): Promise<void> {
		const rootId = this.root.conversations.activeThreadId;
		if (!rootId) {
			return;
		}
		const selector = this.selectorsFor(rootId).get(visibleIndex);
		if (!selector) {
			return;
		}
		const next = (selector.current + delta + selector.total) % selector.total;
		this.setSelection(rootId, selector.parentThreadId, selector.forkVisibleIndex, next);
		this.cancelEdit();
		await this.root.chat.ensureMessages(this.leafFor(rootId));
	}

	regenerate(visibleIndex: number): Promise<void> {
		return this.createBranch(visibleIndex, 'regenerate');
	}

	forkFrom(visibleIndex: number): Promise<void> {
		return this.createBranch(visibleIndex, 'fork');
	}

	beginEdit(visibleIndex: number, currentText: string): void {
		this.editingIndex = visibleIndex;
		this.editDraft = currentText;
	}

	cancelEdit(): void {
		this.editingIndex = undefined;
		this.editDraft = '';
	}

	setEditDraft(value: string): void {
		this.editDraft = value;
	}

	async submitEdit(): Promise<void> {
		const index = this.editingIndex;
		const text = this.editDraft.trim();
		if (index === undefined || !text) {
			return;
		}
		this.cancelEdit();
		await this.createBranch(index, 'edit', text);
	}

	private async createBranch(
		anchorVisibleIndex: number,
		kind: BranchKind,
		editedText?: string,
	): Promise<void> {
		const rootId = this.root.conversations.activeThreadId;
		if (!rootId || this.root.chat.isStreaming) {
			return;
		}
		const sourceThreadId = this.leafFor(rootId);
		// The prefix the branch shares with the displayed transcript; seeded locally
		// so the flip to the new branch never flashes an empty conversation.
		const prefixLength =
			kind === 'edit'
				? anchorVisibleIndex
				: kind === 'regenerate'
					? anchorVisibleIndex - 1
					: anchorVisibleIndex + 1;
		const prefix = this.root.chat
			.messagesFor(sourceThreadId)
			.slice(0, Math.max(prefixLength, 0))
			.map((message) => ({ ...message }));

		let branch: BranchSummary;
		let resendText: string | undefined;
		try {
			({ branch, resendText } = await window.api.branches.create({
				rootThreadId: rootId,
				sourceThreadId,
				anchorVisibleIndex,
				kind,
			}));
		} catch (error) {
			this.root.chat.setError(error instanceof Error ? error.message : String(error));

			return;
		}

		runInAction(() => {
			const family = this.familiesByRoot.get(rootId) ?? [];
			family.push(branch);
			this.familiesByRoot.set(rootId, family);
			this.root.chat.seedMessages(branch.threadId, prefix);
			const members = this.groupsOn(rootId, branch.parentThreadId).get(branch.forkVisibleIndex);
			const position = members?.findIndex((member) => member.threadId === branch.threadId) ?? -1;
			this.setSelection(
				rootId,
				branch.parentThreadId,
				branch.forkVisibleIndex,
				position >= 0 ? position + 1 : 1,
			);
		});

		const message = kind === 'edit' ? editedText : resendText;
		if (message) {
			await this.root.chat.sendTo(branch.threadId, message);
		}
	}

	private walk(rootId: string): { leafId: string; selectors: Map<number, BranchSelectorState> } {
		const selectors = new Map<number, BranchSelectorState>();
		let currentId = rootId;
		for (;;) {
			const groups = [...this.groupsOn(rootId, currentId).entries()].sort((a, b) => a[0] - b[0]);
			let descend: BranchSummary | undefined;
			for (const [forkVisibleIndex, members] of groups) {
				const selected = Math.min(
					this.selections.get(rootId)?.get(selectionKey(currentId, forkVisibleIndex)) ?? 0,
					members.length,
				);
				selectors.set(forkVisibleIndex, {
					parentThreadId: currentId,
					forkVisibleIndex,
					current: selected,
					total: members.length + 1,
				});
				if (selected > 0) {
					descend = members[selected - 1];
					// Groups past the divergence belong to a continuation we left.
					break;
				}
			}
			if (!descend) {
				return { leafId: currentId, selectors };
			}
			currentId = descend.threadId;
		}
	}

	private groupsOn(rootId: string, threadId: string): Map<number, BranchSummary[]> {
		const groups = new Map<number, BranchSummary[]>();
		for (const branch of this.family(rootId)) {
			if (branch.parentThreadId !== threadId) {
				continue;
			}
			const members = groups.get(branch.forkVisibleIndex) ?? [];
			members.push(branch);
			groups.set(branch.forkVisibleIndex, members);
		}
		for (const members of groups.values()) {
			members.sort(
				(a, b) => a.createdAt.localeCompare(b.createdAt) || a.threadId.localeCompare(b.threadId),
			);
		}

		return groups;
	}

	private setSelection(
		rootId: string,
		parentThreadId: string,
		forkVisibleIndex: number,
		option: number,
	): void {
		if (!this.selections.has(rootId)) {
			this.selections.set(rootId, new Map());
		}
		// Re-read after set: MobX deep-converts a plain Map into a new observable
		// instance, so mutating the local original would go nowhere.
		this.selections.get(rootId)?.set(selectionKey(parentThreadId, forkVisibleIndex), option);
	}
}
