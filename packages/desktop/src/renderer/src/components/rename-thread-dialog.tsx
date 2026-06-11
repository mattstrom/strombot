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

export const RenameThreadDialog = observer(function RenameThreadDialog() {
	const { conversations } = useStores();

	return (
		<Dialog
			open={conversations.renameTargetId !== undefined}
			onOpenChange={(open) => {
				if (!open) {
					conversations.closeRenameDialog();
				}
			}}
		>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void conversations.submitRename();
					}}
				>
					<DialogHeader>
						<DialogTitle>Rename conversation</DialogTitle>
					</DialogHeader>
					<div className="grid gap-2 py-4">
						<Label htmlFor="thread-title">Title</Label>
						<Input
							id="thread-title"
							autoFocus
							value={conversations.renameDraft}
							onChange={(event) => conversations.setRenameDraft(event.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => conversations.closeRenameDialog()}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!conversations.renameDraft.trim()}>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
});
