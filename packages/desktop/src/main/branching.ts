import type { BranchKind, BranchSummary, ChatMessage } from '../shared/types';

export interface BranchThreadLike {
	id: string;
	createdAt: Date | string;
	metadata?: Record<string, unknown>;
}

export interface BranchCut {
	// Visible id of the first message excluded from the clone; undefined keeps the whole thread.
	boundaryMessageId?: string;
	forkVisibleIndex: number;
	// For 'regenerate': the user prompt the caller re-sends into the branch.
	resendText?: string;
}

export function computeBranchCut(
	visible: ChatMessage[],
	anchorVisibleIndex: number,
	kind: BranchKind,
): BranchCut {
	const anchor = visible[anchorVisibleIndex];
	if (!anchor) {
		throw new Error(`No message at index ${anchorVisibleIndex}.`);
	}
	switch (kind) {
		case 'edit': {
			if (anchor.role !== 'user') {
				throw new Error('Only user messages can be edited.');
			}

			return { boundaryMessageId: anchor.id, forkVisibleIndex: anchorVisibleIndex };
		}
		case 'regenerate': {
			if (anchor.role !== 'assistant') {
				throw new Error('Only assistant responses can be regenerated.');
			}
			// The send flow strictly alternates user/assistant turns, so the prompt
			// sits directly before the response. Excluding it keeps the regenerated
			// response at the same visible index in the branch as in the parent.
			const prompt = visible[anchorVisibleIndex - 1];
			if (!prompt || prompt.role !== 'user') {
				throw new Error('No user prompt precedes this response.');
			}

			return {
				boundaryMessageId: prompt.id,
				forkVisibleIndex: anchorVisibleIndex,
				resendText: prompt.content,
			};
		}
		case 'fork': {
			return {
				boundaryMessageId: visible[anchorVisibleIndex + 1]?.id,
				forkVisibleIndex: anchorVisibleIndex + 1,
			};
		}
	}
}

export function isBranchThread(metadata: Record<string, unknown> | undefined): boolean {
	return typeof metadata?.branchRootId === 'string';
}

export function toBranchSummary(thread: BranchThreadLike): BranchSummary | undefined {
	const metadata = thread.metadata ?? {};
	const { branchRootId, parentThreadId, forkVisibleIndex, forkKind } = metadata;
	if (
		typeof branchRootId !== 'string' ||
		typeof parentThreadId !== 'string' ||
		typeof forkVisibleIndex !== 'number' ||
		(forkKind !== 'edit' && forkKind !== 'regenerate' && forkKind !== 'fork')
	) {
		return undefined;
	}

	return {
		threadId: thread.id,
		rootThreadId: branchRootId,
		parentThreadId,
		forkVisibleIndex,
		kind: forkKind,
		createdAt: new Date(thread.createdAt).toISOString(),
	};
}
