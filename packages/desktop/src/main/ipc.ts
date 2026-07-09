import { randomUUID } from 'node:crypto';

import { convertMessages } from '@mastra/core/agent';
import { BrowserWindow, dialog, ipcMain } from 'electron';

import type {
	BranchSummary,
	ChatChunk,
	ChatMessage,
	CreateBranchRequest,
	CreateBranchResult,
	Project,
	SendMessageRequest,
	SendMessageResult,
	ThreadSummary,
	UpdateProjectInput,
	UpdateSettings,
	WorkspaceListing,
} from '../shared/types';
import { computeBranchCut, isBranchThread, toBranchSummary } from './branching';
import { createAgent, getMemory, RESOURCE_ID } from './mastra/chat';
import type { ProjectChatContext } from './mastra/chat';
import { readProjectMemory, writeProjectMemory } from './project-files';
import {
	createProject,
	getProject,
	listProjects,
	removeProject,
	renameProject,
	updateProject,
} from './projects';
import { getApiKey, getSettings, updateSettings } from './settings';
import {
	addFilesToWorkspace,
	listWorkspaceFiles,
	removeWorkspaceFile,
	revealWorkspaceFile,
} from './workspace-files';

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
		...(thread.metadata?.pinned === true ? { pinned: true } : {}),
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

// Visible messages are what the renderer displays; their ids are the DB message ids.
// dbMessageIds also covers filtered-out rows (tool calls etc.) in chronological order,
// so branch clones can carry the full context, not just the displayed turns.
async function getThreadMessages(
	threadId: string,
): Promise<{ dbMessageIds: string[]; visible: ChatMessage[] }> {
	const { messages } = await getMemory().recall({ threadId, perPage: false });
	const uiMessages = convertMessages(messages).to('AIV5.UI') as UiMessageLike[];
	const visible = uiMessages
		.filter((message) => message.role === 'user' || message.role === 'assistant')
		.map(toChatMessage)
		.filter((message) => message.content.length > 0);

	return { dbMessageIds: messages.map((message) => message.id), visible };
}

export function registerIpc(): void {
	ipcMain.handle('threads:list', async (): Promise<ThreadSummary[]> => {
		const { threads } = await getMemory().listThreads({
			filter: { resourceId: RESOURCE_ID },
			orderBy: { field: 'updatedAt', direction: 'DESC' },
			perPage: false,
		});

		// Branches are hidden threads. The sidebar shows roots only, sorted by the
		// most recent activity anywhere in the family (saving to a branch does not
		// touch the root's own updatedAt).
		const latestByRoot = new Map<string, number>();
		for (const thread of threads) {
			const rootId =
				typeof thread.metadata?.branchRootId === 'string'
					? thread.metadata.branchRootId
					: thread.id;
			const updatedAt = new Date(thread.updatedAt).getTime();
			latestByRoot.set(rootId, Math.max(latestByRoot.get(rootId) ?? 0, updatedAt));
		}

		return threads
			.filter((thread) => !isBranchThread(thread.metadata))
			.map((thread) =>
				toSummary({
					...thread,
					updatedAt: new Date(latestByRoot.get(thread.id) ?? new Date(thread.updatedAt).getTime()),
				}),
			)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
		// Removing a root takes its hidden branch threads with it.
		const { threads: branches } = await getMemory().listThreads({
			filter: { resourceId: RESOURCE_ID, metadata: { branchRootId: id } },
			perPage: false,
		});
		await Promise.all(branches.map((branch) => getMemory().deleteThread(branch.id)));
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

	// Stored as an explicit boolean because Mastra merges metadata updates,
	// so a removed key would not overwrite the old value.
	ipcMain.handle(
		'threads:setPinned',
		async (_event, id: string, pinned: boolean): Promise<void> => {
			const thread = await getMemory().getThreadById({ threadId: id });
			if (!thread) {
				// Not materialized yet — nothing to pin until the first message lands.
				return;
			}
			await getMemory().updateThread({
				id,
				title: thread.title ?? '',
				metadata: { ...thread.metadata, pinned },
			});
		},
	);

	ipcMain.handle('projects:list', (): Project[] => listProjects());

	ipcMain.handle('projects:create', (_event, name: string): Project => createProject(name));

	ipcMain.handle('projects:rename', (_event, id: string, name: string): void => {
		renameProject(id, name);
	});

	ipcMain.handle('projects:update', (_event, id: string, update: UpdateProjectInput): void => {
		updateProject(id, update);
	});

	ipcMain.handle('projects:memory:get', (_event, id: string): string => readProjectMemory(id));

	ipcMain.handle('projects:memory:set', (_event, id: string, content: string): void => {
		if (getProject(id)) {
			writeProjectMemory(id, content);
		}
	});

	const requireProject = (id: string): Project => {
		const project = getProject(id);
		if (!project) {
			throw new Error(`Unknown project: ${id}`);
		}

		return project;
	};

	ipcMain.handle(
		'projects:files:list',
		(_event, id: string): WorkspaceListing => listWorkspaceFiles(requireProject(id)),
	);

	ipcMain.handle(
		'projects:files:add',
		(_event, id: string, paths: string[]): WorkspaceListing =>
			addFilesToWorkspace(requireProject(id), paths),
	);

	ipcMain.handle(
		'projects:files:addViaDialog',
		async (event, id: string): Promise<WorkspaceListing | null> => {
			const project = requireProject(id);
			const window = BrowserWindow.fromWebContents(event.sender);
			if (!window) {
				return null;
			}
			const result = await dialog.showOpenDialog(window, {
				properties: ['openFile', 'openDirectory', 'multiSelections'],
			});
			if (result.canceled || result.filePaths.length === 0) {
				return null;
			}

			return addFilesToWorkspace(project, result.filePaths);
		},
	);

	ipcMain.handle(
		'projects:files:remove',
		(_event, id: string, relPath: string): Promise<WorkspaceListing> =>
			removeWorkspaceFile(requireProject(id), relPath),
	);

	ipcMain.handle('projects:files:reveal', (_event, id: string, relPath?: string): void => {
		revealWorkspaceFile(requireProject(id), relPath);
	});

	ipcMain.handle('projects:workspace:link', async (event, id: string): Promise<Project | null> => {
		requireProject(id);
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) {
			return null;
		}
		const result = await dialog.showOpenDialog(window, {
			properties: ['openDirectory', 'createDirectory'],
			message: 'Choose a folder to use as this project’s live workspace',
		});
		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}
		updateProject(id, { workspacePath: result.filePaths[0] });

		return requireProject(id);
	});

	ipcMain.handle('projects:workspace:unlink', (_event, id: string): Project => {
		requireProject(id);
		updateProject(id, { workspacePath: null });

		return requireProject(id);
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
		const { visible } = await getThreadMessages(id);

		return visible;
	});

	ipcMain.handle(
		'branches:create',
		async (_event, request: CreateBranchRequest): Promise<CreateBranchResult> => {
			const { rootThreadId, sourceThreadId, anchorVisibleIndex, kind } = request;
			const { dbMessageIds, visible } = await getThreadMessages(sourceThreadId);
			const cut = computeBranchCut(visible, anchorVisibleIndex, kind);

			const root = await getMemory().getThreadById({ threadId: rootThreadId });
			const projectId =
				typeof root?.metadata?.projectId === 'string' ? root.metadata.projectId : undefined;

			// Lift the attachment point: while the fork lands at or before the candidate
			// parent's own divergence point, the new branch is really an alternative to
			// that ancestor (or its shared prefix), so it joins that sibling group.
			// This keeps repeated edits of the same message in one flat ‹ n/m › group.
			let parentThreadId = sourceThreadId;
			for (;;) {
				const candidate = await getMemory().getThreadById({ threadId: parentThreadId });
				const candidateBranch = candidate ? toBranchSummary(candidate) : undefined;
				if (!candidateBranch || cut.forkVisibleIndex > candidateBranch.forkVisibleIndex) {
					break;
				}
				parentThreadId = candidateBranch.parentThreadId;
			}

			// The explicit title keeps Mastra from spending a Haiku call titling a hidden thread.
			const title = 'Branch';
			const metadata = {
				branchRootId: rootThreadId,
				parentThreadId,
				forkVisibleIndex: cut.forkVisibleIndex,
				forkKind: kind,
				...(projectId ? { projectId } : {}),
			};

			let prefixIds = dbMessageIds;
			if (cut.boundaryMessageId) {
				const boundary = dbMessageIds.indexOf(cut.boundaryMessageId);
				if (boundary === -1) {
					throw new Error('Branch point not found in thread history.');
				}
				prefixIds = dbMessageIds.slice(0, boundary);
			}

			// cloneThread treats an empty messageIds filter as "no filter" and would copy
			// everything, so an empty prefix (branching at the first message) gets a fresh
			// thread instead.
			const thread =
				prefixIds.length === 0
					? await getMemory().createThread({ resourceId: RESOURCE_ID, title, metadata })
					: (
							await getMemory().cloneThread({
								sourceThreadId,
								title,
								metadata,
								...(prefixIds.length === dbMessageIds.length
									? {}
									: { options: { messageFilter: { messageIds: prefixIds } } }),
							})
						).thread;

			return {
				branch: {
					threadId: thread.id,
					rootThreadId,
					parentThreadId,
					forkVisibleIndex: cut.forkVisibleIndex,
					kind,
					createdAt: new Date(thread.createdAt).toISOString(),
				},
				...(cut.resendText === undefined ? {} : { resendText: cut.resendText }),
			};
		},
	);

	ipcMain.handle(
		'branches:list',
		async (_event, rootThreadId: string): Promise<BranchSummary[]> => {
			const { threads } = await getMemory().listThreads({
				filter: { resourceId: RESOURCE_ID, metadata: { branchRootId: rootThreadId } },
				orderBy: { field: 'createdAt', direction: 'ASC' },
				perPage: false,
			});

			return threads
				.map(toBranchSummary)
				.filter((branch): branch is BranchSummary => branch !== undefined);
		},
	);

	ipcMain.handle(
		'chat:send',
		async (event, request: SendMessageRequest): Promise<SendMessageResult> => {
			let apiKey: string | undefined;
			try {
				apiKey = getApiKey();
			} catch (error) {
				// e.g. safeStorage cannot decrypt the stored key on this machine.
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
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
				// A stale projectId (project deleted) degrades to an ungrouped chat.
				const project = request.projectId ? getProject(request.projectId) : undefined;
				const projectContext: ProjectChatContext | undefined = project
					? {
							project,
							memory: readProjectMemory(project.id),
							files: listWorkspaceFiles(project),
						}
					: undefined;
				const agent = createAgent(request.model, projectContext);
				const stream = await agent.stream(request.message, {
					memory: {
						// Metadata rides along so the project sticks when Mastra
						// materializes the thread on the first message.
						thread: project
							? { id: request.threadId, metadata: { projectId: project.id } }
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
