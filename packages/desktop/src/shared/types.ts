export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
}

export interface ThreadSummary {
	id: string;
	title: string;
	updatedAt: string;
	projectId?: string;
	pinned?: boolean;
}

export interface Project {
	id: string;
	name: string;
	createdAt: string;
	description?: string;
	instructions?: string;
	// Absolute path of a user-linked workspace folder; absent = internal workspace.
	workspacePath?: string;
}

export interface UpdateProjectInput {
	description?: string;
	instructions?: string;
	// null clears the link (undefined means "leave unchanged").
	workspacePath?: string | null;
}

export interface WorkspaceFileEntry {
	// Relative to the workspace root, posix separators.
	path: string;
	size: number;
	mtimeMs: number;
}

export interface WorkspaceListing {
	// false when a linked folder is missing or unreadable.
	ok: boolean;
	linked: boolean;
	root: string;
	files: WorkspaceFileEntry[];
	truncated: boolean;
	error?: string;
}

export interface SendMessageRequest {
	requestId: string;
	threadId: string;
	message: string;
	model: string;
	projectId?: string;
}

export interface SendMessageResult {
	ok: boolean;
	error?: string;
}

export interface ChatChunk {
	requestId: string;
	threadId: string;
	type: 'text-delta' | 'finish' | 'error';
	text?: string;
	error?: string;
}

export interface Settings {
	model: string;
	hasApiKey: boolean;
}

export interface UpdateSettings {
	model?: string;
	apiKey?: string;
}

export interface ModelOption {
	id: string;
	label: string;
}

export const ANTHROPIC_MODELS: ModelOption[] = [
	{ id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
	{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
	{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
