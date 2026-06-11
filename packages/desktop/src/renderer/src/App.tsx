import { ChatView } from '@/components/chat/chat-view';
import { RenameThreadDialog } from '@/components/rename-thread-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { Sidebar } from '@/components/sidebar/sidebar';
import { StoreProvider } from '@/stores/store-context';

export function App() {
	return (
		<StoreProvider>
			<div className="flex h-full">
				<Sidebar />
				<ChatView />
			</div>
			<SettingsDialog />
			<RenameThreadDialog />
		</StoreProvider>
	);
}
