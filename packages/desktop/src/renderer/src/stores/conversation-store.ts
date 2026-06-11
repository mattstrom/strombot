import type { ThreadSummary } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

export class ConversationStore {
	threads: ThreadSummary[] = [];
	activeThreadId: string | undefined = undefined;

	constructor() {
		makeAutoObservable(this);
	}

	get activeThread(): ThreadSummary | undefined {
		return this.threads.find((thread) => thread.id === this.activeThreadId);
	}

	async load(): Promise<void> {
		const threads = await window.api.threads.list();
		runInAction(() => {
			// The active thread may not be persisted yet (it is materialized on first message).
			const active = this.activeThread;
			this.threads = active && !threads.some((thread) => thread.id === active.id)
				? [active, ...threads]
				: threads;
		});
	}

	select(id: string): void {
		this.activeThreadId = id;
	}

	startNewChat(): void {
		this.activeThreadId = undefined;
	}

	async create(): Promise<ThreadSummary> {
		const thread = await window.api.threads.create();
		runInAction(() => {
			this.threads.unshift(thread);
			this.activeThreadId = thread.id;
		});

		return thread;
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
