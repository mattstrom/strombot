import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '../shared/types';
import { computeBranchCut, toBranchSummary } from './branching';

const transcript: ChatMessage[] = [
	{ id: 'u0', role: 'user', content: 'first question' },
	{ id: 'a1', role: 'assistant', content: 'first answer' },
	{ id: 'u2', role: 'user', content: 'second question' },
	{ id: 'a3', role: 'assistant', content: 'second answer' },
];

describe('computeBranchCut', () => {
	it('edit excludes the edited message onward', () => {
		expect(computeBranchCut(transcript, 2, 'edit')).toEqual({
			boundaryMessageId: 'u2',
			forkVisibleIndex: 2,
		});
	});

	it('edit of the first message yields an empty prefix boundary', () => {
		expect(computeBranchCut(transcript, 0, 'edit')).toEqual({
			boundaryMessageId: 'u0',
			forkVisibleIndex: 0,
		});
	});

	it('edit rejects assistant messages', () => {
		expect(() => computeBranchCut(transcript, 1, 'edit')).toThrow(/user messages/);
	});

	it('regenerate excludes the prompt and returns it for re-sending', () => {
		expect(computeBranchCut(transcript, 3, 'regenerate')).toEqual({
			boundaryMessageId: 'u2',
			forkVisibleIndex: 3,
			resendText: 'second question',
		});
	});

	it('regenerate rejects user messages', () => {
		expect(() => computeBranchCut(transcript, 2, 'regenerate')).toThrow(/assistant responses/);
	});

	it('regenerate requires a directly preceding user prompt', () => {
		const noPrompt: ChatMessage[] = [{ id: 'a0', role: 'assistant', content: 'hello' }];
		expect(() => computeBranchCut(noPrompt, 0, 'regenerate')).toThrow(/prompt/);
	});

	it('fork keeps the anchor and cuts after it', () => {
		expect(computeBranchCut(transcript, 1, 'fork')).toEqual({
			boundaryMessageId: 'u2',
			forkVisibleIndex: 2,
		});
	});

	it('fork at the last message keeps the whole thread', () => {
		expect(computeBranchCut(transcript, 3, 'fork')).toEqual({
			boundaryMessageId: undefined,
			forkVisibleIndex: 4,
		});
	});

	it('rejects an out-of-range anchor', () => {
		expect(() => computeBranchCut(transcript, 4, 'edit')).toThrow(/No message at index/);
	});
});

describe('toBranchSummary', () => {
	it('maps branch metadata onto a summary', () => {
		expect(
			toBranchSummary({
				id: 'b1',
				createdAt: '2026-07-08T10:00:00.000Z',
				metadata: {
					branchRootId: 'root',
					parentThreadId: 'root',
					forkVisibleIndex: 2,
					forkKind: 'edit',
					projectId: 'p1',
				},
			}),
		).toEqual({
			threadId: 'b1',
			rootThreadId: 'root',
			parentThreadId: 'root',
			forkVisibleIndex: 2,
			kind: 'edit',
			createdAt: '2026-07-08T10:00:00.000Z',
		});
	});

	it('returns undefined for non-branch threads', () => {
		expect(toBranchSummary({ id: 't1', createdAt: new Date(), metadata: {} })).toBeUndefined();
		expect(toBranchSummary({ id: 't2', createdAt: new Date() })).toBeUndefined();
		expect(
			toBranchSummary({
				id: 't3',
				createdAt: new Date(),
				metadata: { branchRootId: 'root', parentThreadId: 'root', forkVisibleIndex: 1 },
			}),
		).toBeUndefined();
	});
});
