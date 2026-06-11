import { observer } from 'mobx-react-lite';

import { useStores } from '@/stores/store-context';

import { Composer } from './composer';
import { MessageList } from './message-list';

const EmptyState = observer(function EmptyState() {
	return (
		<div className="flex flex-1 items-center justify-center">
			<h2 className="text-2xl font-medium text-muted-foreground">What can I help with?</h2>
		</div>
	);
});

export const ChatView = observer(function ChatView() {
	const { chat, conversations } = useStores();
	const hasContent = chat.activeMessages.length > 0 || chat.isStreaming;

	return (
		<main className="flex min-w-0 flex-1 flex-col">
			<header className="titlebar-drag flex h-12 shrink-0 items-center border-b px-4">
				<h1 className="truncate text-sm font-medium">
					{conversations.activeThread?.title ?? 'New chat'}
				</h1>
			</header>
			{hasContent ? <MessageList /> : <EmptyState />}
			{chat.error && (
				<div className="mx-auto mb-2 w-full max-w-3xl px-6">
					<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{chat.error}
					</p>
				</div>
			)}
			<Composer />
		</main>
	);
});
