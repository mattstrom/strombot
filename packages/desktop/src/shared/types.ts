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
}

export interface Project {
	id: string;
	name: string;
	createdAt: string;
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
