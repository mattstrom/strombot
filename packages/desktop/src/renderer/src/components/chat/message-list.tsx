import type { ChatMessage } from '@shared/types';
import { GitBranchIcon, PencilIcon, RefreshCcwIcon } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
} from '@/components/ai-elements/message';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { BranchSelector } from '@/components/chat/branch-selector';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BranchSelectorState } from '@/stores/branch-store';
import { useStores } from '@/stores/store-context';

const MessageEditor = observer(function MessageEditor() {
	const { branches } = useStores();

	return (
		<div className="flex w-full min-w-72 flex-col gap-2">
			<Textarea
				autoFocus
				className="bg-transparent"
				onChange={(event) => branches.setEditDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						void branches.submitEdit();
					} else if (event.key === 'Escape') {
						branches.cancelEdit();
					}
				}}
				value={branches.editDraft}
			/>
			<div className="flex justify-end gap-2">
				<Button onClick={() => branches.cancelEdit()} size="sm" type="button" variant="ghost">
					Cancel
				</Button>
				<Button
					disabled={!branches.editDraft.trim()}
					onClick={() => void branches.submitEdit()}
					size="sm"
					type="button"
				>
					Send
				</Button>
			</div>
		</div>
	);
});

const ChatMessageItem = observer(function ChatMessageItem({
	message,
	index,
	selector,
}: {
	message: ChatMessage;
	index: number;
	selector: BranchSelectorState | undefined;
}) {
	const { chat, branches } = useStores();
	const isEditing = branches.editingIndex === index && message.role === 'user';
	const actionsDisabled = chat.isStreaming;

	return (
		<Message from={message.role}>
			<MessageContent className="selectable whitespace-pre-wrap">
				{isEditing ? (
					<MessageEditor />
				) : message.role === 'user' ? (
					message.content
				) : (
					<MessageResponse className="font-serif">{message.content}</MessageResponse>
				)}
			</MessageContent>
			<div className="flex min-h-7 items-center gap-1 group-[.is-user]:justify-end">
				{selector && (
					<BranchSelector
						current={selector.current}
						disabled={actionsDisabled}
						onNext={() => void branches.selectSibling(index, 1)}
						onPrevious={() => void branches.selectSibling(index, -1)}
						total={selector.total}
					/>
				)}
				{!isEditing && (
					<MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
						{message.role === 'user' ? (
							<MessageAction
								disabled={actionsDisabled}
								onClick={() => branches.beginEdit(index, message.content)}
								tooltip="Edit message"
							>
								<PencilIcon size={14} />
							</MessageAction>
						) : (
							<MessageAction
								disabled={actionsDisabled}
								onClick={() => void branches.regenerate(index)}
								tooltip="Regenerate response"
							>
								<RefreshCcwIcon size={14} />
							</MessageAction>
						)}
						<MessageAction
							disabled={actionsDisabled}
							onClick={() => void branches.forkFrom(index)}
							tooltip="Branch from here"
						>
							<GitBranchIcon size={14} />
						</MessageAction>
					</MessageActions>
				)}
			</div>
		</Message>
	);
});

export const MessageList = observer(function MessageList() {
	const { chat, branches, conversations } = useStores();
	const streamText = chat.activeStreamText;
	const messages = chat.activeMessages;
	const rootId = conversations.activeThreadId;
	const selectors = rootId ? branches.selectorsFor(rootId) : undefined;
	// A branch can be shorter than its selector positions (a fresh fork has no
	// tail yet; a failed regenerate can even be empty). Those selectors hang
	// below the transcript so there is always a way to flip back.
	const trailingSelectors =
		!chat.isStreaming && selectors
			? [...selectors.entries()]
					.filter(([index]) => index >= messages.length)
					.sort((a, b) => a[0] - b[0])
			: [];

	return (
		<Conversation>
			<ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-6 py-6">
				{messages.map((message, index) => (
					<ChatMessageItem
						index={index}
						key={message.id}
						message={message}
						selector={selectors?.get(index)}
					/>
				))}
				{trailingSelectors.map(([index, selector]) => (
					<BranchSelector
						current={selector.current}
						key={index}
						onNext={() => void branches.selectSibling(index, 1)}
						onPrevious={() => void branches.selectSibling(index, -1)}
						total={selector.total}
					/>
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
