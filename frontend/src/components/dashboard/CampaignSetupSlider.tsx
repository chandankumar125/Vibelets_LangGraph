import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, Target, MousePointer, DollarSign, Calendar, Check, ChevronDown, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SliderQuestion {
  id: string;
  label: string;
  icon: React.ElementType;
  options: { id: string; label: string; description?: string }[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  extraOptions?: { id: string; label: string }[];
}

// Mapping of objectives to recommended CTAs
const objectiveCtaRecommendations: Record<string, string[]> = {
  'Sales': ['Shop Now', 'Get Offer'],
  'Lead Generation': ['Sign Up', 'Contact Us'],
  'Website Traffic': ['Learn More', 'Download'],
  'Brand Awareness': ['Learn More', 'Subscribe'],
};

const questions: SliderQuestion[] = [
  {
    id: 'objective',
    label: 'Campaign Goal',
    icon: Target,
    options: [
      { id: 'Sales', label: 'Sales', description: 'Drive purchases' },
      { id: 'Lead Generation', label: 'Leads', description: 'Collect leads' },
      { id: 'Website Traffic', label: 'Traffic', description: 'Send visitors' },
      { id: 'Brand Awareness', label: 'Awareness', description: 'Reach people' },
    ]
  },
  {
    id: 'cta',
    label: 'Call-to-Action',
    icon: MousePointer,
    options: [
      { id: 'Shop Now', label: 'Shop Now' },
      { id: 'Learn More', label: 'Learn More' },
      { id: 'Sign Up', label: 'Sign Up' },
      { id: 'Get Offer', label: 'Get Offer' },
    ],
    allowCustom: true,
    extraOptions: [
      { id: 'Book Now', label: 'Book Now' },
      { id: 'Contact Us', label: 'Contact Us' },
      { id: 'Download', label: 'Download' },
      { id: 'Subscribe', label: 'Subscribe' },
    ]
  },
  {
    id: 'budget',
    label: 'Daily Budget',
    icon: DollarSign,
    options: [
      { id: '25', label: '$25/day', description: 'Starter' },
      { id: '50', label: '$50/day', description: 'Recommended' },
      { id: '100', label: '$100/day', description: 'Growth' },
      { id: '200', label: '$200/day', description: 'Scale' },
    ],
    allowCustom: true,
    customPlaceholder: 'Enter custom amount'
  },
  {
    id: 'duration',
    label: 'Duration',
    icon: Calendar,
    options: [
      { id: '7', label: '7 days', description: 'Quick test' },
      { id: '14', label: '14 days', description: 'Standard' },
      { id: '30', label: '30 days', description: 'Extended' },
      { id: 'ongoing', label: 'Ongoing', description: 'Until paused' },
    ]
  }
];

interface CampaignSetupSliderProps {
  onComplete: (config: Record<string, string>) => void;
  disabled?: boolean;
}

export const CampaignSetupSlider = ({ onComplete, disabled }: CampaignSetupSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const currentQuestion = questions[currentIndex];
  const progress = ((Object.keys(answers).length) / questions.length) * 100;
  
  // Get recommended CTAs based on selected objective
  const selectedObjective = answers['objective'];
  const recommendedCtas = selectedObjective ? objectiveCtaRecommendations[selectedObjective] || [] : [];
  
  const isRecommendedCta = (ctaId: string) => {
    return currentQuestion.id === 'cta' && recommendedCtas.includes(ctaId);
  };

  const handleSelect = (optionId: string) => {
    if (disabled || isComplete) return;
    
    const newAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(newAnswers);
    setShowCustomInput(false);
    setCustomValue('');

    // Auto-advance after a brief delay
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsComplete(true);
        onComplete(newAnswers);
      }
    }, 300);
  };

  const handleCustomSubmit = () => {
    if (!customValue || disabled || isComplete) return;
    handleSelect(customValue);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowCustomInput(false);
      setCustomValue('');
    }
  };

  if (isComplete) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Campaign configured!</p>
            <p className="text-xs text-muted-foreground">
              {answers.objective} • ${answers.budget}/day • {answers.duration === 'ongoing' ? 'Ongoing' : `${answers.duration} days`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 animate-fade-in">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {Object.keys(answers).length}/{questions.length}
        </span>
      </div>

      {/* Question card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <button
                onClick={goBack}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <currentQuestion.icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{currentQuestion.label}</span>
          </div>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === currentIndex ? "bg-primary" : 
                  i < currentIndex ? "bg-primary/50" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Options grid */}
        <div className={cn(
          "p-3 grid gap-2",
          currentQuestion.options.length > 4 ? "grid-cols-4" : "grid-cols-2"
        )}>
          {currentQuestion.options.map((option) => {
            const isSelected = answers[currentQuestion.id] === option.id;
            const isRecommended = isRecommendedCta(option.id);
            
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={disabled}
                className={cn(
                  "p-2.5 rounded-lg border text-left transition-all duration-200 relative",
                  currentQuestion.options.length > 4 ? "text-center" : "",
                  isSelected
                    ? "border-secondary bg-secondary/15 shadow-sm"
                    : isRecommended
                    ? "border-secondary/60 bg-secondary/10 shadow-sm"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                {isRecommended && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary text-[8px] font-semibold text-secondary-foreground glow-badge">
                    <Sparkles className="w-2 h-2" />
                    Best
                  </span>
                )}
                <p className="text-xs font-medium text-foreground whitespace-nowrap">{option.label}</p>
                {option.description && currentQuestion.options.length <= 4 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{option.description}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom input option */}
        {currentQuestion.allowCustom && (
          <div className="px-3 pb-3">
            {currentQuestion.extraOptions ? (
              // Dropdown for extra CTA options
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full p-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center justify-center gap-1">
                    + More options
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-card border border-border z-50">
                  {currentQuestion.extraOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      className="text-xs cursor-pointer"
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Text input for custom budget
              <>
                {!showCustomInput ? (
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="w-full p-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    + Enter custom amount
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        placeholder="Enter amount"
                        className="pl-7 h-9 text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                      />
                    </div>
                    <button
                      onClick={handleCustomSubmit}
                      disabled={!customValue}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        customValue 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      Set
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
