import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { cn } from '@/lib/utils';

// Store-driven counterpart of the ai-elements MessageBranchSelector: the branch
// set lives in the BranchStore rather than in local component state.
export function BranchSelector({
	current,
	total,
	onPrevious,
	onNext,
	disabled,
	className,
}: {
	// 0-based selected option.
	current: number;
	total: number;
	onPrevious: () => void;
	onNext: () => void;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<ButtonGroup
			className={cn(
				'[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md',
				className,
			)}
			orientation="horizontal"
		>
			<Button
				aria-label="Previous branch"
				disabled={disabled}
				onClick={onPrevious}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<ChevronLeftIcon size={14} />
			</Button>
			<ButtonGroupText className="border-none bg-transparent text-xs text-muted-foreground shadow-none">
				{current + 1} of {total}
			</ButtonGroupText>
			<Button
				aria-label="Next branch"
				disabled={disabled}
				onClick={onNext}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<ChevronRightIcon size={14} />
			</Button>
		</ButtonGroup>
	);
}
