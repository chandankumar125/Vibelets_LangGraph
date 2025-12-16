import { InlineQuestion } from '@/types/campaign';
import { cn } from '@/lib/utils';
import { Check, Zap, Target, TrendingUp, ShoppingCart, Users, Video, Image, Sparkles, Play, DollarSign, Calendar, MousePointer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  zap: Zap,
  target: Target,
  trending: TrendingUp,
  cart: ShoppingCart,
  users: Users,
  video: Video,
  image: Image,
  sparkles: Sparkles,
  play: Play,
  dollar: DollarSign,
  calendar: Calendar,
  click: MousePointer,
};

// Questions where selection is handled via floating chips (no inline buttons)
const CHIP_HANDLED_QUESTIONS = [
  'product-continue',
  'script-selection', 
  'avatar-selection', 
  'creative-selection', 
  'ad-account-selection'
];

interface InlineQuestionCardProps {
  question: InlineQuestion;
  onAnswer: (questionId: string, answerId: string) => void;
  selectedAnswer?: string;
}

export const InlineQuestionCard = ({ question, onAnswer, selectedAnswer }: InlineQuestionCardProps) => {
  const isChipHandled = CHIP_HANDLED_QUESTIONS.includes(question.id);

  // For chip-handled questions, show only a subtle hint (no buttons in chat)
  if (isChipHandled && !selectedAnswer) {
    return (
      <div className="mt-2 animate-fade-in">
        <p className="text-xs text-muted-foreground italic">
          Use the suggestions below or type your choice...
        </p>
      </div>
    );
  }

  // Show selected answer as confirmation
  if (isChipHandled && selectedAnswer) {
    const selectedOption = question.options.find(o => o.id === selectedAnswer);
    return (
      <div className="mt-2 animate-fade-in">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          <Check className="w-3 h-3" />
          {selectedOption?.label || selectedAnswer}
        </span>
      </div>
    );
  }

  // Default: standard card layout for other questions (publish-confirm, etc.)
  return (
    <div className="mt-3 space-y-2 overflow-hidden animate-fade-in">
      <p className="text-sm font-medium text-foreground break-words">{question.question}</p>
      <div className="flex flex-col gap-1.5">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === option.id;
          const IconComponent = option.icon ? iconMap[option.icon] : null;
          
          return (
            <button
              key={option.id}
              onClick={() => onAnswer(question.id, option.id)}
              disabled={!!selectedAnswer}
              style={{ animationDelay: `${index * 50}ms` }}
              className={cn(
                "group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all duration-200 w-full overflow-hidden animate-fade-in",
                isSelected 
                  ? "border-primary bg-primary/10 shadow-sm"
                  : selectedAnswer
                    ? "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
                    : "border-border bg-card hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm cursor-pointer"
              )}
            >
              {/* Icon or Radio */}
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-all duration-200",
                isSelected 
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
              )}>
                {isSelected ? (
                  <Check className="w-3.5 h-3.5" />
                ) : IconComponent ? (
                  <IconComponent className="w-3.5 h-3.5" />
                ) : (
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full border-2 transition-colors",
                    "border-muted-foreground/40 group-hover:border-primary"
                  )} />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <span className={cn(
                  "text-sm font-medium block truncate transition-colors",
                  isSelected ? "text-primary" : "text-foreground"
                )}>
                  {option.label}
                </span>
                {option.description && (
                  <span className={cn(
                    "text-xs block truncate transition-colors",
                    isSelected ? "text-primary/70" : "text-muted-foreground"
                  )}>
                    {option.description}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
