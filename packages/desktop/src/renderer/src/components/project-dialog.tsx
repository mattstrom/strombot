import { observer } from 'mobx-react-lite';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStores } from '@/stores/store-context';

export const ProjectDialog = observer(function ProjectDialog() {
	const { projects } = useStores();
	const isCreate = projects.dialogMode === 'create';

	return (
		<Dialog
			open={projects.dialogMode !== undefined}
			onOpenChange={(open) => {
				if (!open) {
					projects.closeDialog();
				}
			}}
		>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void projects.submitDialog();
					}}
				>
					<DialogHeader>
						<DialogTitle>{isCreate ? 'New project' : 'Rename project'}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-2 py-4">
						<Label htmlFor="project-name">Name</Label>
						<Input
							id="project-name"
							autoFocus
							value={projects.nameDraft}
							onChange={(event) => projects.setNameDraft(event.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => projects.closeDialog()}>
							Cancel
						</Button>
						<Button type="submit" disabled={!projects.nameDraft.trim()}>
							{isCreate ? 'Create' : 'Save'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
});
