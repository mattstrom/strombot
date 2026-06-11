import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const Markdown = memo(function Markdown({ content }: { content: string }) {
	return (
		<div className="prose prose-neutral dark:prose-invert max-w-none selectable prose-pre:bg-muted prose-pre:text-foreground">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
		</div>
	);
});
