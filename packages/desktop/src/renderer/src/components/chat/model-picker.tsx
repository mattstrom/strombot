import { ANTHROPIC_MODELS } from '@shared/types';
import { observer } from 'mobx-react-lite';

import {
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputSelectValue,
} from '@/components/ai-elements/prompt-input';
import { useStores } from '@/stores/store-context';

export const ModelPicker = observer(function ModelPicker() {
	const { settings } = useStores();

	return (
		<PromptInputSelect
			value={settings.model}
			onValueChange={(model) => void settings.selectModel(model)}
		>
			<PromptInputSelectTrigger size="sm" className="w-fit gap-1 text-xs">
				<PromptInputSelectValue />
			</PromptInputSelectTrigger>
			<PromptInputSelectContent>
				{ANTHROPIC_MODELS.map((model) => (
					<PromptInputSelectItem key={model.id} value={model.id}>
						{model.label}
					</PromptInputSelectItem>
				))}
			</PromptInputSelectContent>
		</PromptInputSelect>
	);
});
