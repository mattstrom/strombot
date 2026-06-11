import type {
	ChatChunk,
	ChatMessage,
	SendMessageRequest,
	SendMessageResult,
	Settings,
	ThreadSummary,
	UpdateSettings,
} from './types';

export interface StrombotApi {
	chat: {
		send(request: SendMessageRequest): Promise<SendMessageResult>;
		abort(requestId: string): Promise<void>;
		onChunk(callback: (chunk: ChatChunk) => void): () => void;
	};
	threads: {
		list(): Promise<ThreadSummary[]>;
		create(): Promise<ThreadSummary>;
		remove(id: string): Promise<void>;
		rename(id: string, title: string): Promise<void>;
		messages(id: string): Promise<ChatMessage[]>;
	};
	settings: {
		get(): Promise<Settings>;
		update(update: UpdateSettings): Promise<Settings>;
	};
}
