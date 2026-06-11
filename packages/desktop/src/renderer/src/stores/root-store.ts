import { ChatStore } from './chat-store';
import { ConversationStore } from './conversation-store';
import { SettingsStore } from './settings-store';

export class RootStore {
	readonly settings = new SettingsStore();
	readonly conversations = new ConversationStore();
	readonly chat: ChatStore;

	constructor() {
		this.chat = new ChatStore(this);
		void this.settings.load();
		void this.conversations.load();
	}
}
