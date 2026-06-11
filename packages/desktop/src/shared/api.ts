import type {
	ChatChunk,
	ChatMessage,
	Project,
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
		create(projectId?: string): Promise<ThreadSummary>;
		remove(id: string): Promise<void>;
		rename(id: string, title: string): Promise<void>;
		move(id: string, projectId: string | null): Promise<void>;
		messages(id: string): Promise<ChatMessage[]>;
	};
	projects: {
		list(): Promise<Project[]>;
		create(name: string): Promise<Project>;
		rename(id: string, name: string): Promise<void>;
		remove(id: string): Promise<void>;
	};
	settings: {
		get(): Promise<Settings>;
		update(update: UpdateSettings): Promise<Settings>;
	};
}
