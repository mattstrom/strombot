import { randomUUID } from 'node:crypto';

import { convertMessages } from '@mastra/core/agent';
import { ipcMain } from 'electron';

import type {
	ChatChunk,
	ChatMessage,
	Project,
	SendMessageRequest,
	SendMessageResult,
	ThreadSummary,
	UpdateSettings,
} from '../shared/types';
import { createAgent, getMemory, RESOURCE_ID } from './mastra/chat';
import { createProject, listProjects, removeProject, renameProject } from './projects';
import { getApiKey, getSettings, updateSettings } from './settings';

const aborts = new Map<string, AbortController>();

interface ThreadLike {
	id: string;
	title?: string;
	updatedAt: Date | string;
	metadata?: Record<string, unknown>;
}

function toSummary(thread: ThreadLike): ThreadSummary {
	// "New Thread <date>" is Mastra's placeholder until the generated title lands.
	const title = thread.title && !thread.title.startsWith('New Thread') ? thread.title : 'New chat';
	const projectId = thread.metadata?.projectId;

	return {
		id: thread.id,
		title,
		updatedAt: new Date(thread.updatedAt).toISOString(),
		...(typeof projectId === 'string' ? { projectId } : {}),
	};
}

interface UiMessageLike {
	id: string;
	role: string;
	parts?: Array<{ type: string; text?: string }>;
}

function toChatMessage(message: UiMessageLike): ChatMessage {
	const content = (message.parts ?? [])
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text)
		.join('');

	return {
		id: message.id,
		role: message.role as ChatMessage['role'],
		content,
	};
}

export function registerIpc(): void {
	ipcMain.handle('threads:list', async (): Promise<ThreadSummary[]> => {
		const { threads } = await getMemory().listThreads({
			filter: { resourceId: RESOURCE_ID },
			orderBy: { field: 'updatedAt', direction: 'DESC' },
			perPage: false,
		});

		return threads.map(toSummary);
	});

	// Mints an id only — the agent materializes the thread on the first message.
	// Threads must reach the database untitled, or Mastra skips title generation.
	ipcMain.handle(
		'threads:create',
		(_event, projectId?: string): ThreadSummary => ({
			id: randomUUID(),
			title: 'New chat',
			updatedAt: new Date().toISOString(),
			...(projectId ? { projectId } : {}),
		}),
	);

	ipcMain.handle('threads:remove', async (_event, id: string): Promise<void> => {
		await getMemory().deleteThread(id);
	});

	ipcMain.handle('threads:rename', async (_event, id: string, title: string): Promise<void> => {
		const thread = await getMemory().getThreadById({ threadId: id });
		await getMemory().updateThread({ id, title, metadata: thread?.metadata ?? {} });
	});

	// projectId null clears the assignment. Stored as an explicit null because Mastra
	// merges metadata updates, so a removed key would not overwrite the old value.
	ipcMain.handle(
		'threads:move',
		async (_event, id: string, projectId: string | null): Promise<void> => {
			const thread = await getMemory().getThreadById({ threadId: id });
			if (!thread) {
				// Not materialized yet — the renderer carries the project onto the first message.
				return;
			}
			await getMemory().updateThread({
				id,
				title: thread.title ?? '',
				metadata: { ...thread.metadata, projectId },
			});
		},
	);

	ipcMain.handle('projects:list', (): Project[] => listProjects());

	ipcMain.handle('projects:create', (_event, name: string): Project => createProject(name));

	ipcMain.handle('projects:rename', (_event, id: string, name: string): void => {
		renameProject(id, name);
	});

	// Removing a project keeps its chats; they fall back to the ungrouped list.
	ipcMain.handle('projects:remove', async (_event, id: string): Promise<void> => {
		removeProject(id);
		const { threads } = await getMemory().listThreads({
			filter: { resourceId: RESOURCE_ID },
			perPage: false,
		});
		await Promise.all(
			threads
				.filter((thread) => thread.metadata?.projectId === id)
				.map((thread) =>
					getMemory().updateThread({
						id: thread.id,
						title: thread.title ?? '',
						metadata: { ...thread.metadata, projectId: null },
					}),
				),
		);
	});

	ipcMain.handle('threads:messages', async (_event, id: string): Promise<ChatMessage[]> => {
		const { messages } = await getMemory().recall({ threadId: id, perPage: false });
		const uiMessages = convertMessages(messages).to('AIV5.UI') as UiMessageLike[];

		return uiMessages
			.filter((message) => message.role === 'user' || message.role === 'assistant')
			.map(toChatMessage)
			.filter((message) => message.content.length > 0);
	});

	ipcMain.handle(
		'chat:send',
		async (event, request: SendMessageRequest): Promise<SendMessageResult> => {
			const apiKey = getApiKey();
			if (!apiKey) {
				return { ok: false, error: 'No API key configured. Add one in Settings.' };
			}
			process.env.ANTHROPIC_API_KEY = apiKey;

			const sender = event.sender;
			const emit = (chunk: ChatChunk): void => {
				if (!sender.isDestroyed()) {
					sender.send('chat:chunk', chunk);
				}
			};

			const controller = new AbortController();
			aborts.set(request.requestId, controller);
			try {
				const agent = createAgent(request.model);
				const stream = await agent.stream(request.message, {
					memory: {
						// Metadata rides along so the project sticks when Mastra
						// materializes the thread on the first message.
						thread: request.projectId
							? { id: request.threadId, metadata: { projectId: request.projectId } }
							: request.threadId,
						resource: RESOURCE_ID,
					},
					abortSignal: controller.signal,
				});
				for await (const chunk of stream.fullStream) {
					if (chunk.type === 'text-delta') {
						emit({
							requestId: request.requestId,
							threadId: request.threadId,
							type: 'text-delta',
							text: chunk.payload.text,
						});
					} else if (chunk.type === 'error') {
						throw new Error(formatChunkError(chunk.payload.error));
					}
				}
				emit({ requestId: request.requestId, threadId: request.threadId, type: 'finish' });

				return { ok: true };
			} catch (error) {
				if (controller.signal.aborted) {
					emit({ requestId: request.requestId, threadId: request.threadId, type: 'finish' });

					return { ok: true };
				}
				const message = error instanceof Error ? error.message : String(error);
				emit({
					requestId: request.requestId,
					threadId: request.threadId,
					type: 'error',
					error: message,
				});

				return { ok: false, error: message };
			} finally {
				aborts.delete(request.requestId);
			}
		},
	);

	ipcMain.handle('chat:abort', (_event, requestId: string): void => {
		aborts.get(requestId)?.abort();
	});

	ipcMain.handle('settings:get', () => getSettings());

	ipcMain.handle('settings:update', (_event, update: UpdateSettings) => updateSettings(update));
}

function formatChunkError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}

	return JSON.stringify(error);
}
