import type { Project, ThreadSummary } from '@shared/types';
import {
	ChevronRight,
	Folder,
	FolderInput,
	FolderMinus,
	MoreHorizontal,
	Pencil,
	Pin,
	PinOff,
	Plus,
	Settings,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { pinnedFirst } from '@/stores/conversation-store';
import { useStores } from '@/stores/store-context';

const ThreadListItem = observer(function ThreadListItem({ thread }: { thread: ThreadSummary }) {
	const { chat, conversations, projects } = useStores();
	const isActive = conversations.activeThreadId === thread.id;
	const moveTargets = projects.projects.filter((project) => project.id !== thread.projectId);
	const canMove = moveTargets.length > 0 || thread.projectId !== undefined;

	return (
		<div
			className={cn(
				'group flex items-center rounded-md text-sm',
				isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
			)}
		>
			<button
				type="button"
				className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left"
				onClick={() => void chat.openThread(thread.id)}
			>
				{thread.pinned && <Pin className="size-3 shrink-0 text-muted-foreground" />}
				<span className="truncate">{thread.title}</span>
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
					<DropdownMenuItem onClick={() => void conversations.togglePin(thread.id)}>
						{thread.pinned ? <PinOff /> : <Pin />}
						{thread.pinned ? 'Unpin' : 'Pin'}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => conversations.openRenameDialog(thread.id)}>
						<Pencil />
						Rename
					</DropdownMenuItem>
					{canMove && (
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<FolderInput />
								Move to project
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								{moveTargets.map((project) => (
									<DropdownMenuItem
										key={project.id}
										onClick={() => {
											void conversations.move(thread.id, project.id);
											projects.expand(project.id);
										}}
									>
										<Folder />
										{project.name}
									</DropdownMenuItem>
								))}
								{thread.projectId !== undefined && (
									<DropdownMenuItem onClick={() => void conversations.move(thread.id, undefined)}>
										<FolderMinus />
										Remove from project
									</DropdownMenuItem>
								)}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					)}
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

const ProjectListItem = observer(function ProjectListItem({ project }: { project: Project }) {
	const { chat, conversations, projects } = useStores();
	const isExpanded = projects.expandedIds.has(project.id);
	const isActive = projects.activePageId === project.id;
	const threads = conversations.threadsInProject(project.id);

	return (
		<div>
			<div
				className={cn(
					'group flex items-center rounded-md text-sm',
					isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
				)}
			>
				<button
					type="button"
					className="shrink-0 py-2 pl-2"
					onClick={() => projects.toggleExpanded(project.id)}
				>
					<ChevronRight
						className={cn('size-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')}
					/>
				</button>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pl-1.5 text-left"
					onClick={() => projects.openPage(project.id)}
				>
					<Folder className="size-4 shrink-0 text-muted-foreground" />
					<span className="truncate">{project.name}</span>
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
							onClick={() => {
								chat.startNewChat(project.id);
								projects.expand(project.id);
							}}
						>
							<Plus />
							New chat
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => projects.openRenameDialog(project.id)}>
							<Pencil />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onClick={() => void projects.remove(project.id)}
						>
							<Trash2 />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{isExpanded && (
				<div className="ml-3.5 space-y-0.5 border-l pl-1.5">
					{threads.map((thread) => (
						<ThreadListItem key={thread.id} thread={thread} />
					))}
					{threads.length === 0 && (
						<p className="px-3 py-2 text-xs text-muted-foreground">No chats yet</p>
					)}
				</div>
			)}
		</div>
	);
});

export const Sidebar = observer(function Sidebar() {
	const { chat, conversations, projects, settings } = useStores();
	// Threads pointing at a deleted project fall back to the ungrouped list.
	const projectIds = new Set(projects.projects.map((project) => project.id));
	const ungrouped = pinnedFirst(
		conversations.threads.filter(
			(thread) => !thread.projectId || !projectIds.has(thread.projectId),
		),
	);

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
			<nav className="flex-1 overflow-y-auto px-3 py-2">
				<div className="mb-1 flex h-6 items-center justify-between pl-2">
					<span className="text-xs font-medium text-muted-foreground">Projects</span>
					<Button
						variant="ghost"
						size="icon"
						className="size-6"
						onClick={() => projects.openCreateDialog()}
					>
						<Plus />
					</Button>
				</div>
				<div className="space-y-0.5">
					{projects.projects.map((project) => (
						<ProjectListItem key={project.id} project={project} />
					))}
					{projects.projects.length === 0 && (
						<p className="px-2 py-1 text-xs text-muted-foreground">No projects yet</p>
					)}
				</div>
				<div className="mb-1 mt-4 flex h-6 items-center pl-2">
					<span className="text-xs font-medium text-muted-foreground">Chats</span>
				</div>
				<div className="space-y-0.5">
					{ungrouped.map((thread) => (
						<ThreadListItem key={thread.id} thread={thread} />
					))}
					{ungrouped.length === 0 && (
						<p className="px-2 py-1 text-xs text-muted-foreground">No conversations yet</p>
					)}
				</div>
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
