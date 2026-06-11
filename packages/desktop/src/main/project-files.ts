import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';

import type { Project } from '../shared/types';

export function projectDir(id: string): string {
	return join(app.getPath('userData'), 'projects', id);
}

export function workspaceDir(id: string): string {
	return join(projectDir(id), 'workspace');
}

// The only sanctioned way to compute the agent's file space. Never pass the
// result to any delete — a linked folder is the user's real data.
export function resolveWorkspaceDir(project: Project): string {
	return project.workspacePath ?? workspaceDir(project.id);
}

function memoryPath(id: string): string {
	return join(projectDir(id), 'memory.md');
}

export function ensureProjectDirs(id: string): void {
	mkdirSync(workspaceDir(id), { recursive: true });
}

export function readProjectMemory(id: string): string {
	try {
		return readFileSync(memoryPath(id), 'utf8');
	} catch {
		return '';
	}
}

export function writeProjectMemory(id: string, content: string): void {
	ensureProjectDirs(id);
	const path = memoryPath(id);
	if (existsSync(path)) {
		copyFileSync(path, `${path}.bak`);
	}
	writeFileSync(path, content);
}

export function removeProjectDir(id: string): void {
	rmSync(projectDir(id), { recursive: true, force: true });
}
