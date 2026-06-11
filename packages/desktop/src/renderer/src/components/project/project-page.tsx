import type { Project, ThreadSummary } from '@shared/types';
import { Folder, Pencil, Pin, Plus, RefreshCw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { ProjectFiles } from '@/components/project/project-files';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useStores } from '@/stores/store-context';

const ThreadRow = observer(function ThreadRow({ thread }: { thread: ThreadSummary }) {
	const { chat, conversations } = useStores();
	const isActive = conversations.activeThreadId === thread.id;

	return (
		<button
			type="button"
			className={cn(
				'flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-left text-sm',
				isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
			)}
			onClick={() => void chat.openThread(thread.id)}
		>
			{thread.pinned && <Pin className="size-3 shrink-0 text-muted-foreground" />}
			<span className="truncate">{thread.title}</span>
		</button>
	);
});

const ProjectPageContent = observer(function ProjectPageContent({ project }: { project: Project }) {
	const { chat, conversations, projects } = useStores();
	const threads = conversations.threadsInProject(project.id);

	const [description, setDescription] = useState(project.description ?? '');
	const [instructions, setInstructions] = useState(project.instructions ?? '');

	const savedMemory = projects.memoryByProject.get(project.id);
	const [memoryDraft, setMemoryDraft] = useState<string | undefined>(undefined);
	const memory = memoryDraft ?? savedMemory ?? '';
	const memoryDirty = memoryDraft !== undefined && memoryDraft !== (savedMemory ?? '');

	return (
		<main className="flex min-w-0 flex-1 flex-col">
			<header className="titlebar-drag flex h-12 shrink-0 items-center justify-between border-b px-4">
				<div className="flex min-w-0 items-center gap-2">
					<Folder className="size-4 shrink-0 text-muted-foreground" />
					<h1 className="truncate text-sm font-medium">{project.name}</h1>
					<Button
						variant="ghost"
						size="icon"
						className="size-6 shrink-0"
						onClick={() => projects.openRenameDialog(project.id)}
					>
						<Pencil />
					</Button>
				</div>
				<Button variant="outline" size="sm" onClick={() => chat.startNewChat(project.id)}>
					<Plus />
					New chat
				</Button>
			</header>
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
					<section className="space-y-2">
						<Label htmlFor="project-description">Description</Label>
						<Textarea
							id="project-description"
							rows={2}
							placeholder="What is this project about?"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							onBlur={() => {
								if (description !== (project.description ?? '')) {
									void projects.update(project.id, { description });
								}
							}}
						/>
					</section>
					<section className="space-y-2">
						<Label htmlFor="project-instructions">Instructions</Label>
						<Textarea
							id="project-instructions"
							rows={4}
							placeholder="e.g. Always answer concisely. Assume I know TypeScript."
							value={instructions}
							onChange={(event) => setInstructions(event.target.value)}
							onBlur={() => {
								if (instructions !== (project.instructions ?? '')) {
									void projects.update(project.id, { instructions });
								}
							}}
						/>
						<p className="text-xs text-muted-foreground">
							Added to the assistant&apos;s system prompt for chats in this project.
						</p>
					</section>
					<ProjectFiles project={project} />
					<section className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="project-memory">Memory</Label>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={() => {
										setMemoryDraft(undefined);
										void projects.loadMemory(project.id);
									}}
								>
									<RefreshCw />
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!memoryDirty}
									onClick={() => {
										if (memoryDraft !== undefined) {
											void projects.saveMemory(project.id, memoryDraft);
											setMemoryDraft(undefined);
										}
									}}
								>
									Save
								</Button>
							</div>
						</div>
						<Textarea
							id="project-memory"
							rows={8}
							className="font-mono text-xs"
							placeholder="The assistant hasn't saved any memory yet."
							value={memory}
							onChange={(event) => setMemoryDraft(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Maintained by the assistant across all chats in this project. You can edit it
							directly.
						</p>
					</section>
					<section className="space-y-2">
						<div className="flex items-center justify-between">
							<Label>Chats</Label>
						</div>
						<div className="space-y-0.5">
							{threads.map((thread) => (
								<ThreadRow key={thread.id} thread={thread} />
							))}
							{threads.length === 0 && (
								<p className="px-3 py-2 text-sm text-muted-foreground">No chats yet</p>
							)}
						</div>
					</section>
				</div>
			</div>
		</main>
	);
});

export const ProjectPage = observer(function ProjectPage() {
	const { projects } = useStores();
	const project = projects.activePage;
	if (!project) {
		return null;
	}

	// Keyed so the textarea drafts reset when switching projects.
	return <ProjectPageContent key={project.id} project={project} />;
});
