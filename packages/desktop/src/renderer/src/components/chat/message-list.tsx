import type { ChatMessage } from '@shared/types';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { useStores } from '@/stores/store-context';

import { Markdown } from './markdown';

function Message({ message }: { message: ChatMessage }) {
	if (message.role === 'user') {
		return (
			<div className="flex justify-end">
				<div className="selectable max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm">
					{message.content}
				</div>
			</div>
		);
	}

	return <Markdown content={message.content} />;
}

export const MessageList = observer(function MessageList() {
	const { chat } = useStores();
	const endRef = useRef<HTMLDivElement>(null);

	const streamText = chat.activeStreamText;
	const messageCount = chat.activeMessages.length;

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: 'end' });
	}, [messageCount, streamText]);

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
				{chat.activeMessages.map((message) => (
					<Message key={message.id} message={message} />
				))}
				{chat.isStreaming &&
					(streamText ? (
						<Markdown content={streamText} />
					) : (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
							Thinking…
						</div>
					))}
				<div ref={endRef} />
			</div>
		</div>
	);
});
