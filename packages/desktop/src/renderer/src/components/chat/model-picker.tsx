import { ANTHROPIC_MODELS } from '@shared/types';
import { observer } from 'mobx-react-lite';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useStores } from '@/stores/store-context';

export const ModelPicker = observer(function ModelPicker() {
	const { settings } = useStores();

	return (
		<Select value={settings.model} onValueChange={(model) => void settings.selectModel(model)}>
			<SelectTrigger size="sm" className="w-fit gap-1 border-0 bg-transparent text-xs shadow-none">
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
	);
});
