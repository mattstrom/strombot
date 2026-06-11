import { DEFAULT_MODEL, type UpdateSettings } from '@shared/types';
import { makeAutoObservable, runInAction } from 'mobx';

export class SettingsStore {
	model: string = DEFAULT_MODEL;
	hasApiKey = false;
	loaded = false;
	dialogOpen = false;
	apiKeyDraft = '';

	constructor() {
		makeAutoObservable(this);
	}

	async load(): Promise<void> {
		const settings = await window.api.settings.get();
		runInAction(() => {
			this.model = settings.model;
			this.hasApiKey = settings.hasApiKey;
			this.loaded = true;
			this.dialogOpen = !settings.hasApiKey;
		});
	}

	setDialogOpen(open: boolean): void {
		this.dialogOpen = open;
		if (!open) {
			this.apiKeyDraft = '';
		}
	}

	setApiKeyDraft(value: string): void {
		this.apiKeyDraft = value;
	}

	async selectModel(model: string): Promise<void> {
		await this.update({ model });
	}

	async save(): Promise<void> {
		const update: UpdateSettings = {};
		if (this.apiKeyDraft.trim()) {
			update.apiKey = this.apiKeyDraft.trim();
		}
		await this.update(update);
		runInAction(() => {
			this.apiKeyDraft = '';
			this.dialogOpen = false;
		});
	}

	private async update(update: UpdateSettings): Promise<void> {
		const settings = await window.api.settings.update(update);
		runInAction(() => {
			this.model = settings.model;
			this.hasApiKey = settings.hasApiKey;
		});
	}
}
