import { BranchStore } from './branch-store';
import { ChatStore } from './chat-store';
import { ConversationStore } from './conversation-store';
import { ProjectStore } from './project-store';
import { SettingsStore } from './settings-store';

export class RootStore {
	readonly settings = new SettingsStore();
	readonly conversations = new ConversationStore();
	readonly projects: ProjectStore;
	readonly branches: BranchStore;
	readonly chat: ChatStore;

	constructor() {
		this.projects = new ProjectStore(this);
		this.branches = new BranchStore(this);
		this.chat = new ChatStore(this);
		void this.settings.load();
		void this.conversations.load();
		void this.projects.load();
	}
}
