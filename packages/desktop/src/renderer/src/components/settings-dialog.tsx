import { ANTHROPIC_MODELS } from '@shared/types';
import { observer } from 'mobx-react-lite';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useStores } from '@/stores/store-context';

export const SettingsDialog = observer(function SettingsDialog() {
	const { settings } = useStores();

	return (
		<Dialog open={settings.dialogOpen} onOpenChange={(open) => settings.setDialogOpen(open)}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Your API key is stored encrypted on this machine and only sent to Anthropic.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<div className="grid gap-2">
						<Label htmlFor="api-key">Anthropic API key</Label>
						<Input
							id="api-key"
							type="password"
							placeholder={settings.hasApiKey ? '••••••••••••••••  (saved)' : 'sk-ant-…'}
							value={settings.apiKeyDraft}
							onChange={(event) => settings.setApiKeyDraft(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label>Default model</Label>
						<Select
							value={settings.model}
							onValueChange={(model) => void settings.selectModel(model)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ANTHROPIC_MODELS.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						onClick={() => void settings.save()}
						disabled={!settings.hasApiKey && !settings.apiKeyDraft.trim()}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});
