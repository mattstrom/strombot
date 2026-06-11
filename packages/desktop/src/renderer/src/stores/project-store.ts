import type { Project, UpdateProjectInput, WorkspaceListing } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

import type { RootStore } from './root-store';

export class ProjectStore {
	projects: Project[] = [];
	expandedIds = new Set<string>();
	// Project whose page is shown in the main pane instead of the chat view.
	activePageId: string | undefined = undefined;
	memoryByProject = new Map<string, string>();
	filesByProject = new Map<string, WorkspaceListing>();

	dialogMode: 'create' | 'rename' | undefined = undefined;
	dialogTargetId: string | undefined = undefined;
	nameDraft = '';

	constructor(private readonly root: RootStore) {
		makeAutoObservable(this);
	}

	get(id: string): Project | undefined {
		return this.projects.find((project) => project.id === id);
	}

	get activePage(): Project | undefined {
		return this.activePageId ? this.get(this.activePageId) : undefined;
	}

	openPage(id: string): void {
		this.activePageId = id;
		this.expandedIds.add(id);
		void this.loadMemory(id);
		void this.loadFiles(id);
	}

	closePage(): void {
		this.activePageId = undefined;
	}

	async load(): Promise<void> {
		const projects = await window.api.projects.list();
		runInAction(() => {
			this.projects = projects;
		});
	}

	toggleExpanded(id: string): void {
		if (this.expandedIds.has(id)) {
			this.expandedIds.delete(id);
		} else {
			this.expandedIds.add(id);
		}
	}

	expand(id: string): void {
		this.expandedIds.add(id);
	}

	async update(id: string, update: UpdateProjectInput): Promise<void> {
		await window.api.projects.update(id, update);
		runInAction(() => {
			const project = this.get(id);
			if (project) {
				if (update.description !== undefined) {
					project.description = update.description;
				}
				if (update.instructions !== undefined) {
					project.instructions = update.instructions;
				}
			}
		});
	}

	async loadMemory(id: string): Promise<void> {
		const memory = await window.api.projects.getMemory(id);
		runInAction(() => {
			this.memoryByProject.set(id, memory);
		});
	}

	async saveMemory(id: string, content: string): Promise<void> {
		await window.api.projects.setMemory(id, content);
		runInAction(() => {
			this.memoryByProject.set(id, content);
		});
	}

	async loadFiles(id: string): Promise<void> {
		const listing = await window.api.projects.listFiles(id);
		runInAction(() => {
			this.filesByProject.set(id, listing);
		});
	}

	async addFiles(id: string, paths: string[]): Promise<void> {
		if (paths.length === 0) {
			return;
		}
		const listing = await window.api.projects.addFiles(id, paths);
		runInAction(() => {
			this.filesByProject.set(id, listing);
		});
	}

	async addFilesViaDialog(id: string): Promise<void> {
		const listing = await window.api.projects.addFilesViaDialog(id);
		if (listing) {
			runInAction(() => {
				this.filesByProject.set(id, listing);
			});
		}
	}

	async removeFile(id: string, relPath: string): Promise<void> {
		const listing = await window.api.projects.removeFile(id, relPath);
		runInAction(() => {
			this.filesByProject.set(id, listing);
		});
	}

	reveal(id: string, relPath?: string): void {
		void window.api.projects.revealFile(id, relPath);
	}

	async linkWorkspace(id: string): Promise<void> {
		const updated = await window.api.projects.linkWorkspace(id);
		if (!updated) {
			return;
		}
		runInAction(() => {
			const index = this.projects.findIndex((project) => project.id === id);
			if (index !== -1) {
				this.projects[index] = updated;
			}
		});
		await this.loadFiles(id);
	}

	async unlinkWorkspace(id: string): Promise<void> {
		const updated = await window.api.projects.unlinkWorkspace(id);
		runInAction(() => {
			const index = this.projects.findIndex((project) => project.id === id);
			if (index !== -1) {
				this.projects[index] = updated;
			}
		});
		await this.loadFiles(id);
	}

	async remove(id: string): Promise<void> {
		await window.api.projects.remove(id);
		runInAction(() => {
			this.projects = this.projects.filter((project) => project.id !== id);
			this.expandedIds.delete(id);
			this.memoryByProject.delete(id);
			this.filesByProject.delete(id);
			if (this.activePageId === id) {
				this.activePageId = undefined;
			}
			this.root.conversations.clearProject(id);
		});
	}

	openCreateDialog(): void {
		this.dialogMode = 'create';
		this.dialogTargetId = undefined;
		this.nameDraft = '';
	}

	openRenameDialog(id: string): void {
		this.dialogMode = 'rename';
		this.dialogTargetId = id;
		this.nameDraft = this.get(id)?.name ?? '';
	}

	closeDialog(): void {
		this.dialogMode = undefined;
		this.dialogTargetId = undefined;
		this.nameDraft = '';
	}

	setNameDraft(value: string): void {
		this.nameDraft = value;
	}

	async submitDialog(): Promise<void> {
		const name = this.nameDraft.trim();
		if (!name) {
			return;
		}
		if (this.dialogMode === 'create') {
			const project = await window.api.projects.create(name);
			runInAction(() => {
				this.projects.push(project);
				this.expandedIds.add(project.id);
			});
		} else if (this.dialogMode === 'rename' && this.dialogTargetId) {
			const id = this.dialogTargetId;
			await window.api.projects.rename(id, name);
			runInAction(() => {
				const project = this.get(id);
				if (project) {
					project.name = name;
				}
			});
		}
		runInAction(() => {
			this.closeDialog();
		});
	}
}
