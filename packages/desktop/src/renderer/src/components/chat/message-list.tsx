import type { ChatMessage } from '@shared/types';
import { observer } from 'mobx-react-lite';

import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { useStores } from '@/stores/store-context';

function ChatMessageItem({ message }: { message: ChatMessage }) {
	return (
		<Message from={message.role}>
			<MessageContent className="selectable whitespace-pre-wrap">
				{message.role === 'user' ? (
					message.content
				) : (
					<MessageResponse className="font-serif">{message.content}</MessageResponse>
				)}
			</MessageContent>
		</Message>
	);
}

export const MessageList = observer(function MessageList() {
	const { chat } = useStores();
	const streamText = chat.activeStreamText;

	return (
		<Conversation>
			<ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-6 py-6">
				{chat.activeMessages.map((message) => (
					<ChatMessageItem key={message.id} message={message} />
				))}
				{chat.isStreaming && (
					<Message from="assistant">
						<MessageContent className="selectable">
							{streamText ? (
								<MessageResponse isAnimating className="font-serif">
									{streamText}
								</MessageResponse>
							) : (
								<Shimmer className="text-sm">Thinking…</Shimmer>
							)}
						</MessageContent>
					</Message>
				)}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	);
});
