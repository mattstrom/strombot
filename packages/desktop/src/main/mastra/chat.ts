import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { app } from 'electron';
import { z } from 'zod';

import type { Project, WorkspaceListing } from '../../shared/types';
import { resolveWorkspaceDir, writeProjectMemory } from '../project-files';
import { getProject } from '../projects';
import { buildFileListingBlock } from '../workspace-files';

export const RESOURCE_ID = 'strombot-user';

const INSTRUCTIONS = `You are Strombot, a personal AI assistant.
Be direct and helpful. Format responses in Markdown when it aids readability.`;

export interface ProjectChatContext {
	project: Project;
	memory: string;
	files: WorkspaceListing;
}

function buildInstructions(context?: ProjectChatContext): string {
	if (!context) {
		return INSTRUCTIONS;
	}

	const { project, memory } = context;
	const blocks = [INSTRUCTIONS, `# Project: ${project.name}`];

	if (project.description?.trim()) {
		blocks.push(`## About this project\n${project.description.trim()}`);
	}
	if (project.instructions?.trim()) {
		blocks.push(
			'## Project instructions\n' +
				'The user has set these instructions for all chats in this project. Follow them:\n' +
				project.instructions.trim(),
		);
	}
	blocks.push(
		'## Project memory\n' +
			'This is your persistent memory for this project, maintained by you across conversations:\n\n' +
			(memory.trim() || '(No memory saved yet.)'),
		buildFileListingBlock(context.files),
		'Use the update_project_memory tool to persist durable information: user preferences, ' +
			'decisions, project facts, and ongoing goals. The tool replaces the entire document, so ' +
			'always pass the full updated markdown, preserving everything still relevant. Do not ' +
			'store transient conversation details; keep it concise. Update silently without ' +
			'announcing routine memory updates. Your workspace files belong to this project and ' +
			'are shared with the user.',
	);

	return blocks.join('\n\n');
}

function createUpdateMemoryTool(projectId: string) {
	return createTool({
		id: 'update_project_memory',
		description:
			'Replace the project memory document. Pass the complete markdown document, ' +
			'including all content that should be retained — anything omitted is lost.',
		inputSchema: z.object({
			memory: z.string().describe('The complete replacement markdown memory document'),
		}),
		execute: async ({ memory }) => {
			// Guard against resurrecting the directory if the project was deleted mid-chat.
			if (!getProject(projectId)) {
				return { ok: false, error: 'Project no longer exists' };
			}
			writeProjectMemory(projectId, memory);

			return { ok: true };
		},
	});
}

let memory: Memory | undefined;

export function getMemory(): Memory {
	memory ??= new Memory({
		storage: new LibSQLStore({
			id: 'strombot-storage',
			url: `file:${join(app.getPath('userData'), 'strombot.db')}`,
		}),
		options: {
			lastMessages: 30,
			generateTitle: {
				model: 'anthropic/claude-haiku-4-5-20251001',
				instructions:
					'Generate a short title (2-6 words) summarizing the topic of the user message. ' +
					'Respond with the title only: no quotes, no trailing punctuation, no commentary. ' +
					'Never address the user or explain yourself.',
			},
		},
	});

	return memory;
}

export function createAgent(model: string, projectContext?: ProjectChatContext): Agent {
	return new Agent({
		id: 'strombot',
		name: 'Strombot',
		instructions: buildInstructions(projectContext),
		model: `anthropic/${model}`,
		memory: getMemory(),
		...(projectContext
			? {
					tools: {
						update_project_memory: createUpdateMemoryTool(projectContext.project.id),
					},
					workspace: new Workspace({
						filesystem: new LocalFilesystem({
							basePath: resolveWorkspaceDir(projectContext.project),
						}),
					}),
				}
			: {}),
	});
}
