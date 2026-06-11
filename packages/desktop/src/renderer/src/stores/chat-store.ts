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

	get activeThreadId(): string | undefined {
		return this.root.conversations.activeThreadId;
	}

	get activeMessages(): ChatMessage[] {
		if (!this.activeThreadId) {
			return [];
		}

		return this.messagesByThread.get(this.activeThreadId) ?? [];
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

	startNewChat(projectId?: string): void {
		this.root.conversations.startNewChat(projectId);
		this.error = undefined;
	}

	async openThread(id: string): Promise<void> {
		this.root.conversations.select(id);
		this.error = undefined;
		if (this.loadedThreads.has(id) || this.streams.has(id)) {
			return;
		}
		const messages = await window.api.threads.messages(id);
		runInAction(() => {
			if (!this.streams.has(id)) {
				this.messagesByThread.set(id, messages);
				this.loadedThreads.add(id);
			}
		});
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
		const projectId = this.root.conversations.threads.find(
			(thread) => thread.id === threadId,
		)?.projectId;

		const requestId = crypto.randomUUID();
		runInAction(() => {
			const messages = this.messagesByThread.get(threadId) ?? [];
			messages.push({ id: crypto.randomUUID(), role: 'user', content });
			this.messagesByThread.set(threadId, messages);
			this.streams.set(threadId, { requestId, text: '' });
		});

		const result = await window.api.chat.send({
			requestId,
			threadId,
			message: content,
			model: this.root.settings.model,
			projectId,
		});
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
			// Refresh twice: thread titles are generated asynchronously after the stream ends.
			void this.root.conversations.load();
			setTimeout(() => void this.root.conversations.load(), 3000);
		} else if (chunk.type === 'error') {
			this.streams.delete(chunk.threadId);
			this.error = chunk.error ?? 'Something went wrong.';
		}
	}
}
