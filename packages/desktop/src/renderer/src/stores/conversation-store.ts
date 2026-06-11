import type { ThreadSummary } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

export class ConversationStore {
	threads: ThreadSummary[] = [];
	activeThreadId: string | undefined = undefined;
	// Project that the next new chat lands in (set by "New chat" inside a project).
	pendingProjectId: string | undefined = undefined;
	renameTargetId: string | undefined = undefined;
	renameDraft = '';

	constructor() {
		makeAutoObservable(this);
	}

	get activeThread(): ThreadSummary | undefined {
		return this.threads.find((thread) => thread.id === this.activeThreadId);
	}

	threadsInProject(projectId: string): ThreadSummary[] {
		return this.threads.filter((thread) => thread.projectId === projectId);
	}

	async load(): Promise<void> {
		const threads = await window.api.threads.list();
		runInAction(() => {
			// The active thread may not be persisted yet (it is materialized on first message).
			const active = this.activeThread;
			this.threads =
				active && !threads.some((thread) => thread.id === active.id)
					? [active, ...threads]
					: threads;
		});
	}

	select(id: string): void {
		this.activeThreadId = id;
		this.pendingProjectId = undefined;
	}

	startNewChat(projectId?: string): void {
		this.activeThreadId = undefined;
		this.pendingProjectId = projectId;
	}

	async create(): Promise<ThreadSummary> {
		const thread = await window.api.threads.create(this.pendingProjectId);
		runInAction(() => {
			this.threads.unshift(thread);
			this.activeThreadId = thread.id;
			this.pendingProjectId = undefined;
		});

		return thread;
	}

	async move(id: string, projectId: string | undefined): Promise<void> {
		await window.api.threads.move(id, projectId ?? null);
		runInAction(() => {
			const thread = this.threads.find((entry) => entry.id === id);
			if (thread) {
				thread.projectId = projectId;
			}
		});
	}

	// Called when a project is deleted; its threads fall back to the ungrouped list.
	clearProject(projectId: string): void {
		for (const thread of this.threads) {
			if (thread.projectId === projectId) {
				thread.projectId = undefined;
			}
		}
		if (this.pendingProjectId === projectId) {
			this.pendingProjectId = undefined;
		}
	}

	async remove(id: string): Promise<void> {
		await window.api.threads.remove(id);
		runInAction(() => {
			this.threads = this.threads.filter((thread) => thread.id !== id);
			if (this.activeThreadId === id) {
				this.activeThreadId = undefined;
			}
		});
	}

	openRenameDialog(id: string): void {
		const thread = this.threads.find((entry) => entry.id === id);
		this.renameTargetId = id;
		this.renameDraft = thread?.title ?? '';
	}

	closeRenameDialog(): void {
		this.renameTargetId = undefined;
		this.renameDraft = '';
	}

	setRenameDraft(value: string): void {
		this.renameDraft = value;
	}

	async submitRename(): Promise<void> {
		const id = this.renameTargetId;
		const title = this.renameDraft.trim();
		if (!id || !title) {
			return;
		}
		await this.rename(id, title);
		runInAction(() => {
			this.closeRenameDialog();
		});
	}

	async rename(id: string, title: string): Promise<void> {
		await window.api.threads.rename(id, title);
		runInAction(() => {
			const thread = this.threads.find((entry) => entry.id === id);
			if (thread) {
				thread.title = title;
			}
		});
	}
}
