import { copyFileSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

import { shell } from 'electron';

import { formatBytes } from '../shared/format';
import type { Project, WorkspaceFileEntry, WorkspaceListing } from '../shared/types';
import { ensureProjectDirs, resolveWorkspaceDir } from './project-files';

const MAX_FILES = 200;
const MAX_DEPTH = 8;
const MAX_DIRS = 500;

function skipEntry(name: string): boolean {
	return name.startsWith('.') || name === 'node_modules';
}

export function listWorkspaceFiles(project: Project): WorkspaceListing {
	const linked = project.workspacePath !== undefined;
	const root = resolveWorkspaceDir(project);
	if (!linked) {
		ensureProjectDirs(project.id);
	}

	const files: WorkspaceFileEntry[] = [];
	let truncated = false;
	let dirsVisited = 0;

	const walk = (dir: string, prefix: string, depth: number): void => {
		if (depth > MAX_DEPTH || dirsVisited >= MAX_DIRS) {
			truncated = true;

			return;
		}
		dirsVisited += 1;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (skipEntry(entry.name) || entry.isSymbolicLink()) {
				continue;
			}
			if (files.length >= MAX_FILES) {
				truncated = true;

				return;
			}
			const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				walk(join(dir, entry.name), relPath, depth + 1);
			} else if (entry.isFile()) {
				const stats = statSync(join(dir, entry.name));
				files.push({ path: relPath, size: stats.size, mtimeMs: stats.mtimeMs });
			}
		}
	};

	try {
		walk(root, '', 0);
	} catch (error) {
		return {
			ok: false,
			linked,
			root,
			files: [],
			truncated: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
	files.sort((a, b) => a.path.localeCompare(b.path));

	return { ok: true, linked, root, files, truncated };
}

// Finder-style collision avoidance: name.ext, name (2).ext, name (3).ext, ...
function availableName(dir: string, name: string): string {
	if (!existsSync(join(dir, name))) {
		return name;
	}
	const ext = extname(name);
	const stem = name.slice(0, name.length - ext.length);
	for (let counter = 2; ; counter += 1) {
		const candidate = `${stem} (${counter})${ext}`;
		if (!existsSync(join(dir, candidate))) {
			return candidate;
		}
	}
}

function isInside(parent: string, child: string): boolean {
	const rel = relative(parent, child);

	return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
}

export function addFilesToWorkspace(project: Project, sourcePaths: string[]): WorkspaceListing {
	const root = resolveWorkspaceDir(project);
	if (project.workspacePath === undefined) {
		ensureProjectDirs(project.id);
	}
	for (const source of sourcePaths) {
		const abs = resolve(source);
		// Already inside the workspace (e.g. dragged from its own list) — nothing to do.
		// Copying a folder that contains the workspace would recurse forever.
		if (abs === root || isInside(root, abs) || isInside(abs, root)) {
			continue;
		}
		const stats = statSync(abs);
		const dest = join(root, availableName(root, basename(abs)));
		if (stats.isDirectory()) {
			cpSync(abs, dest, { recursive: true });
		} else if (stats.isFile()) {
			copyFileSync(abs, dest);
		}
	}

	return listWorkspaceFiles(project);
}

// Renderer-supplied paths are untrusted; refuse anything outside the root.
function containedPath(project: Project, relPath: string): string {
	const root = resolveWorkspaceDir(project);
	const abs = resolve(root, relPath);
	if (!isInside(root, abs)) {
		throw new Error(`Path escapes the workspace: ${relPath}`);
	}

	return abs;
}

export async function removeWorkspaceFile(
	project: Project,
	relPath: string,
): Promise<WorkspaceListing> {
	await shell.trashItem(containedPath(project, relPath));

	return listWorkspaceFiles(project);
}

export function revealWorkspaceFile(project: Project, relPath?: string): void {
	if (relPath) {
		shell.showItemInFolder(containedPath(project, relPath));
	} else {
		void shell.openPath(resolveWorkspaceDir(project));
	}
}

export function buildFileListingBlock(listing: WorkspaceListing): string {
	const header =
		'## Workspace files\n' +
		'Your workspace is shared live with the user — they add and edit these files directly ' +
		'on disk, so contents can change between messages. Read a file with your workspace ' +
		'tools before relying on it.';
	if (!listing.ok) {
		return (
			`${header}\n\n` +
			'(The linked workspace folder is currently unavailable — it may have been moved or ' +
			'deleted. Tell the user if they ask about files.)'
		);
	}
	if (listing.files.length === 0) {
		return `${header}\n\n(The workspace is currently empty.)`;
	}
	const lines = listing.files.map((file) => `- ${file.path} (${formatBytes(file.size)})`);
	if (listing.truncated) {
		lines.push(`(listing truncated at ${MAX_FILES} files; more exist on disk)`);
	}

	return `${header}\n\nCurrent files:\n${lines.join('\n')}`;
}
