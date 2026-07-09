import type { BranchSummary } from '@shared/types';
import { beforeEach, describe, expect, it } from 'vitest';

import { BranchStore } from './branch-store';
import type { RootStore } from './root-store';

const ROOT = 'root';

function branch(
	overrides: Partial<BranchSummary> & Pick<BranchSummary, 'threadId'>,
): BranchSummary {
	return {
		rootThreadId: ROOT,
		parentThreadId: ROOT,
		forkVisibleIndex: 0,
		kind: 'regenerate',
		createdAt: '2026-07-08T10:00:00.000Z',
		...overrides,
	};
}

function makeStore(family: BranchSummary[]): BranchStore {
	const fakeRoot = {
		conversations: { activeThreadId: ROOT },
		chat: {
			isStreaming: false,
			ensureMessages: async () => {},
			messagesFor: () => [],
			seedMessages: () => {},
			sendTo: async () => {},
			setError: () => {},
		},
	} as unknown as RootStore;
	Object.assign(globalThis, {
		window: { api: { branches: { list: async () => family } } },
	});

	return new BranchStore(fakeRoot);
}

describe('BranchStore walk', () => {
	beforeEach(() => {
		Reflect.deleteProperty(globalThis, 'window');
	});

	it('unbranched conversation: leaf is the root, no selectors', async () => {
		const store = makeStore([]);
		await store.load(ROOT);
		expect(store.leafFor(ROOT)).toBe(ROOT);
		expect(store.selectorsFor(ROOT).size).toBe(0);
	});

	it('defaults to the parent continuation and flips to a sibling', async () => {
		const store = makeStore([branch({ threadId: 'b1', forkVisibleIndex: 3 })]);
		await store.load(ROOT);

		expect(store.leafFor(ROOT)).toBe(ROOT);
		expect(store.selectorsFor(ROOT).get(3)).toMatchObject({ current: 0, total: 2 });

		await store.selectSibling(3, 1);
		expect(store.leafFor(ROOT)).toBe('b1');
		expect(store.selectorsFor(ROOT).get(3)).toMatchObject({ current: 1, total: 2 });
	});

	it('wraps around when stepping past the last sibling', async () => {
		const store = makeStore([
			branch({ threadId: 'b1', forkVisibleIndex: 3, createdAt: '2026-07-08T10:00:00.000Z' }),
			branch({ threadId: 'b2', forkVisibleIndex: 3, createdAt: '2026-07-08T11:00:00.000Z' }),
		]);
		await store.load(ROOT);

		await store.selectSibling(3, -1);
		expect(store.leafFor(ROOT)).toBe('b2');
		await store.selectSibling(3, 1);
		expect(store.leafFor(ROOT)).toBe(ROOT);
	});

	it('descends through nested branches', async () => {
		const store = makeStore([
			branch({ threadId: 'b1', forkVisibleIndex: 2 }),
			branch({ threadId: 'b2', parentThreadId: 'b1', forkVisibleIndex: 4 }),
		]);
		await store.load(ROOT);

		await store.selectSibling(2, 1);
		expect(store.leafFor(ROOT)).toBe('b1');
		expect(store.selectorsFor(ROOT).get(4)).toMatchObject({ current: 0, total: 2 });

		await store.selectSibling(4, 1);
		expect(store.leafFor(ROOT)).toBe('b2');
		expect(store.selectorsFor(ROOT).get(2)).toMatchObject({ current: 1, total: 2 });
		expect(store.selectorsFor(ROOT).get(4)).toMatchObject({ current: 1, total: 2 });
	});

	it('hides groups beyond the current divergence point', async () => {
		const store = makeStore([
			branch({ threadId: 'b1', forkVisibleIndex: 2 }),
			branch({ threadId: 'b3', forkVisibleIndex: 4 }),
		]);
		await store.load(ROOT);

		// On the root path both groups are visible.
		expect([...store.selectorsFor(ROOT).keys()].sort((a, b) => a - b)).toEqual([2, 4]);

		// After diverging at 2, the root's continuation at 4 is off-path.
		await store.selectSibling(2, 1);
		expect([...store.selectorsFor(ROOT).keys()]).toEqual([2]);

		// Selections deeper in an abandoned path are remembered when flipping back.
		await store.selectSibling(2, -1);
		expect([...store.selectorsFor(ROOT).keys()].sort((a, b) => a - b)).toEqual([2, 4]);
	});
});
