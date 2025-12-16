import { cn } from '@/lib/utils';
import { CampaignStep, InlineQuestion } from '@/types/campaign';

interface SuggestionChipsProps {
  activeQuestion: InlineQuestion | null;
  onSelect: (optionId: string) => void;
  currentStep: CampaignStep;
  disabled?: boolean;
}

export const SuggestionChips = ({ 
  activeQuestion, 
  onSelect, 
  currentStep,
  disabled 
}: SuggestionChipsProps) => {
  if (!activeQuestion || disabled) return null;

  const isCompactQuestion = activeQuestion.id === 'product-continue';
  const isCustomOption = (id: string) => id.includes('custom');

  return (
    <div className="px-4 py-2 border-t border-border/30 bg-muted/20 backdrop-blur-sm">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground mr-1">
          {isCompactQuestion ? 'Quick actions:' : 'Suggestions:'}
        </span>
        {activeQuestion.options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            disabled={disabled}
            style={{ animationDelay: `${index * 40}ms` }}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 animate-fade-in",
              "hover:shadow-md active:scale-95",
              isCustomOption(option.id)
                ? "bg-secondary/15 text-secondary border border-secondary/25 hover:bg-secondary/25 hover:border-secondary/40"
                : "bg-background border border-border hover:bg-muted hover:border-primary/30 text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
