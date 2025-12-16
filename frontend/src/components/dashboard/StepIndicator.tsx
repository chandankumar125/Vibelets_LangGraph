import { CampaignStep } from '@/types/campaign';
import { cn } from '@/lib/utils';
import { Check, Link, Sparkles, Settings, Rocket } from 'lucide-react';

// Grouped step configuration - 4 main steps instead of 8
const STEP_GROUPS: { 
  id: string; 
  label: string; 
  icon: React.ElementType;
  steps: CampaignStep[];
}[] = [
  { 
    id: 'product', 
    label: 'Product', 
    icon: Link,
    steps: ['product-analysis']
  },
  { 
    id: 'content', 
    label: 'Content', 
    icon: Sparkles,
    steps: ['script-selection', 'avatar-selection', 'creative-generation', 'creative-review']
  },
  { 
    id: 'campaign', 
    label: 'Campaign', 
    icon: Settings,
    steps: ['campaign-setup', 'facebook-integration', 'ad-account-selection']
  },
  { 
    id: 'review', 
    label: 'Review & Publish', 
    icon: Rocket,
    steps: ['campaign-preview', 'publishing', 'published']
  },
];

interface StepIndicatorProps {
  currentStep: CampaignStep;
  onStepClick: (step: CampaignStep) => void;
  disabled?: boolean;
}

export const StepIndicator = ({ currentStep, onStepClick, disabled = false }: StepIndicatorProps) => {
  // Find which group the current step belongs to
  const getCurrentGroupIndex = () => {
    for (let i = 0; i < STEP_GROUPS.length; i++) {
      if (STEP_GROUPS[i].steps.includes(currentStep)) {
        return i;
      }
    }
    return 0;
  };

  const currentGroupIndex = getCurrentGroupIndex();
  const isFullyCompleted = currentStep === 'published';

  // Get the first step of a group for navigation
  const getFirstStepOfGroup = (groupIndex: number): CampaignStep => {
    return STEP_GROUPS[groupIndex].steps[0];
  };

  // If disabled, show muted/inactive state
  if (disabled) {
    return (
      <div className="px-6 py-4 border-b border-border bg-muted/30 opacity-50 pointer-events-none">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
            Campaign Published
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full w-full" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 overflow-x-auto pb-1">
          {STEP_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div
                key={group.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-secondary/15 text-secondary border border-secondary/30"
              >
                <Check className="w-4 h-4" />
                <span>{group.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 border-b border-border bg-background">
      {/* Progress bar */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
          {isFullyCompleted ? 'Completed' : `Step ${currentGroupIndex + 1} of ${STEP_GROUPS.length}`}
        </span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: isFullyCompleted 
                ? '100%' 
                : `${((currentGroupIndex + 1) / STEP_GROUPS.length) * 100}%` 
            }}
          />
        </div>
      </div>

      {/* Step navigation pills - centered */}
      <div className="flex items-center justify-center gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {STEP_GROUPS.map((group, index) => {
          const isCompleted = index < currentGroupIndex || isFullyCompleted;
          const isCurrent = index === currentGroupIndex && !isFullyCompleted;
          const isClickable = isCompleted && index < currentGroupIndex;
          const Icon = group.icon;
          
          return (
            <button
              key={group.id}
              onClick={() => isClickable && onStepClick(getFirstStepOfGroup(index))}
              disabled={!isClickable}
              title={group.label}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                isCurrent && "bg-primary text-primary-foreground border-primary shadow-md",
                isCompleted && !isCurrent && "bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/25 cursor-pointer",
                !isCompleted && !isCurrent && "bg-muted/50 text-muted-foreground border-transparent"
              )}
            >
              {isCompleted && !isCurrent ? (
                <Check className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span>{group.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
