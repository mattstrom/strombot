import { formatBytes } from '@shared/format';
import type { Project } from '@shared/types';
import {
	File,
	FolderInput,
	FolderMinus,
	FolderOpen,
	MoreHorizontal,
	Plus,
	RefreshCw,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useStores } from '@/stores/store-context';

export const ProjectFiles = observer(function ProjectFiles({ project }: { project: Project }) {
	const { projects } = useStores();
	const listing = projects.filesByProject.get(project.id);
	const [isDragging, setIsDragging] = useState(false);

	// Files may have changed in Finder or an editor while the app was unfocused.
	useEffect(() => {
		const refresh = (): void => void projects.loadFiles(project.id);
		window.addEventListener('focus', refresh);

		return () => window.removeEventListener('focus', refresh);
	}, [projects, project.id]);

	const handleDrop = (event: DragEvent): void => {
		event.preventDefault();
		setIsDragging(false);
		const paths = Array.from(event.dataTransfer.files)
			.map((file) => window.api.files.getPathForFile(file))
			.filter(Boolean);
		void projects.addFiles(project.id, paths);
	};

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<Label>Files</Label>
					{listing?.linked && (
						<span className="truncate text-xs text-muted-foreground" title={listing.root}>
							{listing.root}
						</span>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="size-7"
						onClick={() => void projects.loadFiles(project.id)}
					>
						<RefreshCw />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void projects.addFilesViaDialog(project.id)}
					>
						<Plus />
						Add files
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-7">
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => projects.reveal(project.id)}>
								<FolderOpen />
								Show in Finder
							</DropdownMenuItem>
							{listing?.linked ? (
								<DropdownMenuItem onClick={() => void projects.unlinkWorkspace(project.id)}>
									<FolderMinus />
									Unlink folder
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onClick={() => void projects.linkWorkspace(project.id)}>
									<FolderInput />
									Link folder…
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			{listing && !listing.ok ? (
				<div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
					<p className="text-sm text-amber-600">
						Linked folder not found at <span className="font-mono text-xs">{listing.root}</span>
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => void projects.linkWorkspace(project.id)}
						>
							Relink…
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => void projects.unlinkWorkspace(project.id)}
						>
							Unlink
						</Button>
					</div>
				</div>
			) : (
				<div
					className={cn(
						'rounded-md border border-dashed p-1 transition-colors',
						isDragging ? 'border-primary bg-accent/40' : 'border-transparent',
					)}
					onDragOver={(event) => {
						event.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={handleDrop}
				>
					{listing && listing.files.length > 0 ? (
						<div className="space-y-0.5">
							{listing.files.map((file) => (
								<div
									key={file.path}
									className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
								>
									<File className="size-4 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1 truncate">{file.path}</span>
									<span className="shrink-0 text-xs text-muted-foreground">
										{formatBytes(file.size)}
									</span>
									<div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
										<Button
											variant="ghost"
											size="icon"
											className="size-6"
											onClick={() => projects.reveal(project.id, file.path)}
										>
											<FolderOpen />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="size-6"
											onClick={() => void projects.removeFile(project.id, file.path)}
										>
											<Trash2 />
										</Button>
									</div>
								</div>
							))}
							{listing.truncated && (
								<p className="px-2 py-1 text-xs text-muted-foreground">
									Showing the first {listing.files.length} files
								</p>
							)}
						</div>
					) : (
						<p className="px-2 py-3 text-sm text-muted-foreground">
							No files yet. Add files or drop them here.
						</p>
					)}
				</div>
			)}
			<p className="text-xs text-muted-foreground">
				{listing?.linked
					? 'Live folder — changes on disk are visible to the assistant immediately.'
					: 'Files the assistant can read and write for this project.'}{' '}
				Removed files go to the Trash.
			</p>
		</section>
	);
});
