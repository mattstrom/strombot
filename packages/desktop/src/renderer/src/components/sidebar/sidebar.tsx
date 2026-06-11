import type { ThreadSummary } from '@shared/types';
import { MoreHorizontal, Plus, Settings, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useStores } from '@/stores/store-context';

const ThreadListItem = observer(function ThreadListItem({ thread }: { thread: ThreadSummary }) {
	const { chat, conversations } = useStores();
	const isActive = conversations.activeThreadId === thread.id;

	return (
		<div
			className={cn(
				'group flex items-center rounded-md text-sm',
				isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
			)}
		>
			<button
				type="button"
				className="min-w-0 flex-1 truncate px-3 py-2 text-left"
				onClick={() => void chat.openThread(thread.id)}
			>
				{thread.title}
			</button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="mr-1 size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
					>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" side="bottom">
					<DropdownMenuItem
						variant="destructive"
						onClick={() => void conversations.remove(thread.id)}
					>
						<Trash2 />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
});

export const Sidebar = observer(function Sidebar() {
	const { chat, conversations, settings } = useStores();

	return (
		<aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
			<div className="titlebar-drag flex h-12 shrink-0 items-center pl-20 pr-3">
				<span className="text-sm font-semibold tracking-tight">Strombot</span>
			</div>
			<div className="px-3 pb-2">
				<Button
					variant="outline"
					className="w-full justify-start gap-2"
					onClick={() => chat.startNewChat()}
				>
					<Plus />
					New chat
				</Button>
			</div>
			<nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
				{conversations.threads.map((thread) => (
					<ThreadListItem key={thread.id} thread={thread} />
				))}
				{conversations.threads.length === 0 && (
					<p className="px-3 py-2 text-xs text-muted-foreground">No conversations yet</p>
				)}
			</nav>
			<div className="border-t p-3">
				<Button
					variant="ghost"
					className="w-full justify-start gap-2"
					onClick={() => settings.setDialogOpen(true)}
				>
					<Settings />
					Settings
				</Button>
			</div>
		</aside>
	);
});
