import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { app } from 'electron';

export const RESOURCE_ID = 'strombot-user';

const INSTRUCTIONS = `You are Strombot, a personal AI assistant.
Be direct and helpful. Format responses in Markdown when it aids readability.`;

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

export function createAgent(model: string): Agent {
	return new Agent({
		id: 'strombot',
		name: 'Strombot',
		instructions: INSTRUCTIONS,
		model: `anthropic/${model}`,
		memory: getMemory(),
	});
}
