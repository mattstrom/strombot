import { observer } from 'mobx-react-lite';

import { ChatView } from '@/components/chat/chat-view';
import { ProjectDialog } from '@/components/project-dialog';
import { ProjectPage } from '@/components/project/project-page';
import { RenameThreadDialog } from '@/components/rename-thread-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { Sidebar } from '@/components/sidebar/sidebar';
import { StoreProvider, useStores } from '@/stores/store-context';

const MainPane = observer(function MainPane() {
	const { projects } = useStores();

	return projects.activePage ? <ProjectPage /> : <ChatView />;
});

export function App() {
	return (
		<StoreProvider>
			<div className="flex h-full">
				<Sidebar />
				<MainPane />
			</div>
			<SettingsDialog />
			<RenameThreadDialog />
			<ProjectDialog />
		</StoreProvider>
	);
}
