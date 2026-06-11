import type {
	ChatChunk,
	ChatMessage,
	Project,
	SendMessageRequest,
	SendMessageResult,
	Settings,
	ThreadSummary,
	UpdateProjectInput,
	UpdateSettings,
	WorkspaceListing,
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
		setPinned(id: string, pinned: boolean): Promise<void>;
		messages(id: string): Promise<ChatMessage[]>;
	};
	projects: {
		list(): Promise<Project[]>;
		create(name: string): Promise<Project>;
		rename(id: string, name: string): Promise<void>;
		update(id: string, update: UpdateProjectInput): Promise<void>;
		remove(id: string): Promise<void>;
		getMemory(id: string): Promise<string>;
		setMemory(id: string, content: string): Promise<void>;
		listFiles(id: string): Promise<WorkspaceListing>;
		addFiles(id: string, paths: string[]): Promise<WorkspaceListing>;
		addFilesViaDialog(id: string): Promise<WorkspaceListing | null>;
		removeFile(id: string, relPath: string): Promise<WorkspaceListing>;
		revealFile(id: string, relPath?: string): Promise<void>;
		linkWorkspace(id: string): Promise<Project | null>;
		unlinkWorkspace(id: string): Promise<Project>;
	};
	files: {
		// Resolves a dragged File's absolute path (webUtils lives in the preload).
		getPathForFile(file: File): string;
	};
	settings: {
		get(): Promise<Settings>;
		update(update: UpdateSettings): Promise<Settings>;
	};
}
