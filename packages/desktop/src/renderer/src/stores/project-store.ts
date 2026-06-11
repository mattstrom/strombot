import type { Project } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

import type { RootStore } from './root-store';

export class ProjectStore {
	projects: Project[] = [];
	expandedIds = new Set<string>();

	dialogMode: 'create' | 'rename' | undefined = undefined;
	dialogTargetId: string | undefined = undefined;
	nameDraft = '';

	constructor(private readonly root: RootStore) {
		makeAutoObservable(this);
	}

	get(id: string): Project | undefined {
		return this.projects.find((project) => project.id === id);
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

	async remove(id: string): Promise<void> {
		await window.api.projects.remove(id);
		runInAction(() => {
			this.projects = this.projects.filter((project) => project.id !== id);
			this.expandedIds.delete(id);
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
