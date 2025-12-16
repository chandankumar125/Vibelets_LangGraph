import { useState } from 'react';
import { AIRecommendation, PublishedCampaign } from '@/types/campaign';
import { Sparkles, Check, X, TrendingUp, Copy, Play, Pause, DollarSign, Maximize2, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InlineRecommendationsProps {
  recommendations: AIRecommendation[];
  campaigns: PublishedCampaign[];
  onAction: (recommendationId: string, action: string, value?: number) => void;
  onCloneCreative?: (recommendation: AIRecommendation) => void;
}

// Action state type for tracking user decisions
type ActionState = 'pending' | 'accepted' | 'dismissed' | 'deferred';

// Priority badge component - using amber for high priority, muted for others
const PriorityBadge = ({ priority }: { priority: AIRecommendation['priority'] }) => {
  const config = {
    high: { label: 'Urgent', className: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
    medium: { label: 'Medium', className: 'bg-muted text-muted-foreground border-border' },
    suggestion: { label: 'Tip', className: 'bg-muted text-muted-foreground border-border' }
  };

  const { label, className } = config[priority];

  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", className)}>
      {label}
    </Badge>
  );
};

// Action state badge to show user's decision
const ActionStateBadge = ({ state }: { state: ActionState }) => {
  if (state === 'pending') return null;
  
  const config = {
    accepted: { label: 'Applied', icon: ThumbsUp, className: 'bg-secondary/20 text-secondary border-secondary/30' },
    dismissed: { label: 'Skipped', icon: ThumbsDown, className: 'bg-muted text-muted-foreground border-border' },
    deferred: { label: 'Later', icon: Clock, className: 'bg-amber-500/20 text-amber-600 border-amber-500/30' }
  };

  const { label, icon: Icon, className } = config[state];

  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1", className)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
};

// Type icon component - using muted colors, not purple
const TypeIcon = ({ type, priority }: { type: AIRecommendation['type']; priority: AIRecommendation['priority'] }) => {
  const icons = {
    'budget-increase': TrendingUp,
    'budget-decrease': DollarSign,
    'pause-creative': Pause,
    'resume-campaign': Play,
    'clone-creative': Copy
  };
  const Icon = icons[type];
  const isUrgent = priority === 'high';
  
  return (
    <div className={cn(
      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
      isUrgent ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"
    )}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
};

// Individual recommendation card - compact for 2x2 grid
const RecommendationCard = ({ 
  recommendation, 
  onAction,
  onCloneCreative,
  isExpanded = false
}: { 
  recommendation: AIRecommendation; 
  onAction: (recommendationId: string, action: string, value?: number) => void;
  onCloneCreative?: (recommendation: AIRecommendation) => void;
  isExpanded?: boolean;
}) => {
  const [customBudget, setCustomBudget] = useState(recommendation.recommendedValue || 0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionState, setActionState] = useState<ActionState>('pending');

  const isBudgetRecommendation = recommendation.type === 'budget-increase' || recommendation.type === 'budget-decrease';

  const handleQuickAction = async (budgetValue?: number) => {
    setIsProcessing(true);
    const valueToApply = budgetValue ?? (showCustomInput ? parseFloat(customInputValue) : recommendation.recommendedValue);
    
    switch (recommendation.type) {
      case 'budget-increase':
      case 'budget-decrease':
        onAction(recommendation.id, 'apply', valueToApply);
        toast.success(`Budget updated to $${valueToApply}/day`);
        break;
      case 'pause-creative':
        onAction(recommendation.id, 'pause');
        toast.success('Creative paused successfully');
        break;
      case 'resume-campaign':
        onAction(recommendation.id, 'resume', recommendation.recommendedValue);
        toast.success('Campaign resumed');
        break;
      case 'clone-creative':
        if (onCloneCreative) {
          onCloneCreative(recommendation);
        } else {
          onAction(recommendation.id, 'clone');
          toast.success('Creative cloning started - new campaign will be created');
        }
        break;
    }
    
    setActionState('accepted');
    setTimeout(() => setIsProcessing(false), 500);
  };

  const handleCustomBudgetApply = () => {
    const value = parseFloat(customInputValue);
    if (!isNaN(value) && value > 0) {
      handleQuickAction(value);
      setShowCustomInput(false);
      setCustomInputValue('');
    } else {
      toast.error('Please enter a valid budget amount');
    }
  };

  const handleDismiss = () => {
    onAction(recommendation.id, 'dismiss');
    setActionState('dismissed');
    toast.info('Recommendation skipped');
  };

  const handleDefer = () => {
    onAction(recommendation.id, 'remind');
    setActionState('deferred');
    toast.info('Will remind you later');
  };

  const getQuickActionLabel = () => {
    // When custom mode is active, show "Apply Custom" instead of AI recommended value
    if (showCustomInput && isBudgetRecommendation) {
      return 'Apply Custom';
    }
    
    switch (recommendation.type) {
      case 'budget-increase':
      case 'budget-decrease':
        return `$${recommendation.recommendedValue}/day`;
      case 'pause-creative':
        return 'Pause';
      case 'resume-campaign':
        return 'Resume';
      case 'clone-creative':
        return 'Clone';
    }
  };

  const getCustomButtonLabel = () => {
    // When custom mode is active, show "Use AI Recommended" instead of "Custom"
    return showCustomInput ? 'AI Recommended' : 'Custom';
  };

  return (
    <div className={cn(
      "glass-card p-3 rounded-xl transition-all h-full flex flex-col",
      recommendation.priority === 'high' && "border-amber-500/30 bg-amber-500/5",
      actionState !== 'pending' && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <TypeIcon type={recommendation.type} priority={recommendation.priority} />
          <PriorityBadge priority={recommendation.priority} />
          <ActionStateBadge state={actionState} />
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleDismiss}
          disabled={actionState !== 'pending'}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{recommendation.campaignName}</p>
        <h4 className={cn(
          "text-xs font-semibold text-foreground",
          isExpanded ? "" : "line-clamp-1"
        )}>{recommendation.title}</h4>
        <p className={cn(
          "text-[10px] text-muted-foreground mt-0.5",
          isExpanded ? "" : "line-clamp-2"
        )}>{recommendation.reasoning}</p>
      </div>

      {/* Creative preview for creative-related recommendations */}
      {recommendation.creative && (
        <div className="flex items-center gap-2 my-1.5 p-1.5 rounded-lg bg-muted/30">
          <img 
            src={recommendation.creative.thumbnail} 
            alt={recommendation.creative.name}
            className="w-8 h-8 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-foreground truncate">{recommendation.creative.name}</p>
          </div>
        </div>
      )}

      {/* Budget controls for budget recommendations */}
      {isBudgetRecommendation && (
        <div className="my-1.5 p-1.5 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between text-[9px] mb-0.5">
            <span className="text-muted-foreground">Current: ${recommendation.currentValue}/day</span>
          </div>
          {showCustomInput ? (
            <div className="flex items-center gap-1 mt-1">
              <Input
                type="number"
                value={customInputValue}
                onChange={(e) => setCustomInputValue(e.target.value)}
                placeholder="Enter amount"
                className="h-6 text-[10px] px-2"
                disabled={actionState !== 'pending'}
              />
              <Button size="sm" variant="secondary" className="h-6 px-1.5 text-[10px]" onClick={handleCustomBudgetApply} disabled={actionState !== 'pending'}>
                <Check className="h-2.5 w-2.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => setShowCustomInput(false)} disabled={actionState !== 'pending'}>
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          ) : (
            <Slider
              value={[customBudget]}
              onValueChange={(v) => setCustomBudget(v[0])}
              min={10}
              max={Math.max((recommendation.recommendedValue || 50) * 2, 200)}
              step={5}
              className="w-full mt-0.5"
              disabled={actionState !== 'pending'}
            />
          )}
        </div>
      )}

      {/* Action buttons - smaller, refined */}
      {actionState === 'pending' && (
        <div className="flex items-center gap-1 mt-1.5">
          <Button 
            size="sm" 
            variant="secondary"
            onClick={() => handleQuickAction()}
            disabled={isProcessing}
            className="flex-1 h-6 text-[10px] px-2"
          >
            {isProcessing ? (
              <span>Applying...</span>
            ) : (
              <>
                <Check className="h-2.5 w-2.5 mr-0.5" />
                {getQuickActionLabel()}
              </>
            )}
          </Button>
          {isBudgetRecommendation && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="h-6 text-[10px] px-2"
            >
              {getCustomButtonLabel()}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const InlineRecommendations = ({ 
  recommendations, 
  campaigns, 
  onAction,
  onCloneCreative 
}: InlineRecommendationsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (recommendations.length === 0) {
    return (
      <div className="p-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">All optimized!</p>
              <p className="text-xs text-muted-foreground">No recommendations right now</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        {/* Header with expand button - removed purple */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Recommendations</h3>
              <p className="text-[10px] text-muted-foreground">
                {recommendations.length} action{recommendations.length !== 1 ? 's' : ''} to improve performance
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 2x2 Grid of recommendations */}
        <div className="grid grid-cols-2 gap-2">
          {recommendations.map((rec) => (
            <RecommendationCard 
              key={rec.id} 
              recommendation={rec} 
              onAction={onAction}
              onCloneCreative={onCloneCreative}
            />
          ))}
        </div>
      </div>

      {/* Expanded Dialog View */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <span className="text-sm">AI Recommendations</span>
                <p className="text-[10px] text-muted-foreground font-normal mt-0.5">
                  {recommendations.length} action{recommendations.length !== 1 ? 's' : ''} to improve performance
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              {recommendations.map((rec) => (
                <RecommendationCard 
                  key={rec.id} 
                  recommendation={rec} 
                  onAction={(id, action, value) => {
                    onAction(id, action, value);
                  }}
                  onCloneCreative={onCloneCreative}
                  isExpanded
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};