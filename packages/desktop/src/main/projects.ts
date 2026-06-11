import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';

import type { Project } from '../shared/types';

interface StoredProjects {
	projects: Project[];
}

function projectsPath(): string {
	return join(app.getPath('userData'), 'projects.json');
}

function readStored(): StoredProjects {
	try {
		return JSON.parse(readFileSync(projectsPath(), 'utf8')) as StoredProjects;
	} catch {
		return { projects: [] };
	}
}

function writeStored(stored: StoredProjects): void {
	writeFileSync(projectsPath(), JSON.stringify(stored, null, 2));
}

export function listProjects(): Project[] {
	return readStored().projects;
}

export function createProject(name: string): Project {
	const project: Project = {
		id: randomUUID(),
		name,
		createdAt: new Date().toISOString(),
	};
	const stored = readStored();
	stored.projects.push(project);
	writeStored(stored);

	return project;
}

export function renameProject(id: string, name: string): void {
	const stored = readStored();
	const project = stored.projects.find((entry) => entry.id === id);
	if (project) {
		project.name = name;
		writeStored(stored);
	}
}

export function removeProject(id: string): void {
	const stored = readStored();
	stored.projects = stored.projects.filter((entry) => entry.id !== id);
	writeStored(stored);
}
