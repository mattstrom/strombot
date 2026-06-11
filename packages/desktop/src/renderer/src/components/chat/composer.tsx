import { ArrowUp, Square } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStores } from '@/stores/store-context';

import { ModelPicker } from './model-picker';

export const Composer = observer(function Composer() {
	const { chat } = useStores();

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			void chat.send();
		}
	};

	return (
		<div className="shrink-0 px-6 pb-4">
			<div className="mx-auto max-w-3xl rounded-xl border bg-card shadow-sm focus-within:border-ring">
				<Textarea
					value={chat.draft}
					onChange={(event) => chat.setDraft(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Message Strombot…"
					className="max-h-48 min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
				/>
				<div className="flex items-center justify-between px-2 pb-2">
					<ModelPicker />
					{chat.isStreaming ? (
						<Button size="icon" variant="secondary" onClick={() => chat.abort()} aria-label="Stop">
							<Square />
						</Button>
					) : (
						<Button
							size="icon"
							disabled={!chat.canSend}
							onClick={() => void chat.send()}
							aria-label="Send"
						>
							<ArrowUp />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
});
