import { observer } from 'mobx-react-lite';

import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { useStores } from '@/stores/store-context';

import { ModelPicker } from './model-picker';

export const Composer = observer(function Composer() {
	const { chat } = useStores();

	return (
		<div className="shrink-0 px-6 pb-4">
			<PromptInput className="mx-auto max-w-3xl" onSubmit={() => void chat.send()}>
				<PromptInputBody>
					<PromptInputTextarea
						value={chat.draft}
						onChange={(event) => chat.setDraft(event.target.value)}
						placeholder="Message Strombot…"
					/>
				</PromptInputBody>
				<PromptInputFooter>
					<PromptInputTools>
						<ModelPicker />
					</PromptInputTools>
					<PromptInputSubmit
						status={chat.isStreaming ? 'streaming' : 'ready'}
						disabled={!chat.isStreaming && !chat.canSend}
						onStop={() => chat.abort()}
					/>
				</PromptInputFooter>
			</PromptInput>
		</div>
	);
});
