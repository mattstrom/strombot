import type { ChatChunk, ChatMessage } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

import type { RootStore } from './root-store';

interface StreamState {
	requestId: string;
	text: string;
}

export class ChatStore {
	draft = '';
	error: string | undefined = undefined;

	private messagesByThread = new Map<string, ChatMessage[]>();
	private streams = new Map<string, StreamState>();
	private loadedThreads = new Set<string>();

	constructor(private readonly root: RootStore) {
		makeAutoObservable(this);
		window.api.chat.onChunk((chunk) => this.handleChunk(chunk));
	}

	// The thread whose transcript is displayed and receives sends: the selected
	// branch leaf of the active conversation (the root itself when unbranched).
	get activeThreadId(): string | undefined {
		const rootId = this.root.conversations.activeThreadId;

		return rootId ? this.root.branches.leafFor(rootId) : undefined;
	}

	get activeMessages(): ChatMessage[] {
		if (!this.activeThreadId) {
			return [];
		}

		return this.messagesByThread.get(this.activeThreadId) ?? [];
	}

	messagesFor(threadId: string): ChatMessage[] {
		return this.messagesByThread.get(threadId) ?? [];
	}

	get activeStreamText(): string {
		if (!this.activeThreadId) {
			return '';
		}

		return this.streams.get(this.activeThreadId)?.text ?? '';
	}

	get isStreaming(): boolean {
		return this.activeThreadId !== undefined && this.streams.has(this.activeThreadId);
	}

	get canSend(): boolean {
		return this.draft.trim().length > 0 && !this.isStreaming;
	}

	setDraft(value: string): void {
		this.draft = value;
	}

	setError(message: string | undefined): void {
		this.error = message;
	}

	// Registers a branch's shared prefix without a round-trip, so flipping to a
	// freshly created branch shows the transcript immediately.
	seedMessages(threadId: string, messages: ChatMessage[]): void {
		this.messagesByThread.set(threadId, messages);
		this.loadedThreads.add(threadId);
	}

	async ensureMessages(threadId: string): Promise<void> {
		if (this.loadedThreads.has(threadId) || this.streams.has(threadId)) {
			return;
		}
		const messages = await window.api.threads.messages(threadId);
		runInAction(() => {
			if (!this.streams.has(threadId) && !this.loadedThreads.has(threadId)) {
				this.messagesByThread.set(threadId, messages);
				this.loadedThreads.add(threadId);
			}
		});
	}

	startNewChat(projectId?: string): void {
		this.root.conversations.startNewChat(projectId);
		this.root.projects.closePage();
		this.error = undefined;
	}

	async openThread(id: string): Promise<void> {
		this.root.conversations.select(id);
		this.root.projects.closePage();
		this.error = undefined;
		void this.root.branches.load(id);
		await this.ensureMessages(id);
	}

	async send(): Promise<void> {
		const content = this.draft.trim();
		if (!content || this.isStreaming) {
			return;
		}
		this.draft = '';
		this.error = undefined;

		let threadId = this.activeThreadId;
		if (!threadId) {
			const thread = await this.root.conversations.create();
			threadId = thread.id;
			runInAction(() => {
				this.loadedThreads.add(thread.id);
			});
		}
		await this.sendTo(threadId, content);
	}

	async sendTo(threadId: string, content: string): Promise<void> {
		// Branch threads are not in the sidebar list; the project rides on the root.
		const rootId = this.root.conversations.activeThreadId;
		const projectId = this.root.conversations.threads.find(
			(thread) => thread.id === rootId,
		)?.projectId;

		const requestId = crypto.randomUUID();
		runInAction(() => {
			this.error = undefined;
			const messages = this.messagesByThread.get(threadId) ?? [];
			messages.push({ id: crypto.randomUUID(), role: 'user', content });
			this.messagesByThread.set(threadId, messages);
			this.loadedThreads.add(threadId);
			this.streams.set(threadId, { requestId, text: '' });
		});

		// A rejected invoke must still clear the stream, or the thread shows
		// "Thinking…" forever.
		const result = await window.api.chat
			.send({
				requestId,
				threadId,
				message: content,
				model: this.root.settings.model,
				projectId,
			})
			.catch((error: unknown) => ({
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			}));
		if (!result.ok) {
			runInAction(() => {
				this.streams.delete(threadId);
				this.error = result.error ?? 'Something went wrong.';
			});
		}
	}

	abort(): void {
		if (!this.activeThreadId) {
			return;
		}
		const stream = this.streams.get(this.activeThreadId);
		if (stream) {
			void window.api.chat.abort(stream.requestId);
		}
	}

	private handleChunk(chunk: ChatChunk): void {
		const stream = this.streams.get(chunk.threadId);
		if (!stream || stream.requestId !== chunk.requestId) {
			return;
		}
		if (chunk.type === 'text-delta') {
			stream.text += chunk.text ?? '';
		} else if (chunk.type === 'finish') {
			if (stream.text) {
				const messages = this.messagesByThread.get(chunk.threadId) ?? [];
				messages.push({ id: crypto.randomUUID(), role: 'assistant', content: stream.text });
				this.messagesByThread.set(chunk.threadId, messages);
			}
			this.streams.delete(chunk.threadId);
			// Swap locally minted message ids for the persisted ones.
			void this.reconcile(chunk.threadId);
			// Refresh twice: thread titles are generated asynchronously after the stream ends.
			void this.root.conversations.load();
			setTimeout(() => void this.root.conversations.load(), 3000);
			// The agent may have written workspace files during the turn.
			const pageId = this.root.projects.activePageId;
			if (pageId) {
				void this.root.projects.loadFiles(pageId);
			}
		} else if (chunk.type === 'error') {
			this.streams.delete(chunk.threadId);
			this.error = chunk.error ?? 'Something went wrong.';
		}
	}

	private async reconcile(threadId: string): Promise<void> {
		const messages = await window.api.threads.messages(threadId);
		runInAction(() => {
			const current = this.messagesByThread.get(threadId) ?? [];
			// Skip if a new stream started, or persistence hasn't caught up yet —
			// never drop optimistic messages.
			if (!this.streams.has(threadId) && messages.length >= current.length) {
				this.messagesByThread.set(threadId, messages);
				this.loadedThreads.add(threadId);
			}
		});
	}
}
