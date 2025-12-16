import { AIRecommendation } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { DollarSign, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BudgetAdjustmentCardProps {
  recommendation: AIRecommendation;
  onAction: (recommendationId: string, action: string, value?: number) => void;
}

export const BudgetAdjustmentCard = ({ recommendation, onAction }: BudgetAdjustmentCardProps) => {
  const [customBudget, setCustomBudget] = useState(recommendation.recommendedValue || recommendation.currentValue || 50);
  const [isCustomMode, setIsCustomMode] = useState(false);

  const isIncrease = recommendation.type === 'budget-increase';
  const Icon = isIncrease ? TrendingUp : TrendingDown;

  const getPriorityColor = () => {
    switch (recommendation.priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between mb-2">
          <Badge className={cn("text-xs", getPriorityColor())}>
            {recommendation.priority === 'high' ? 'High Priority' : 
             recommendation.priority === 'medium' ? 'Medium' : 'Suggestion'}
          </Badge>
          <span className="text-xs text-muted-foreground">{recommendation.campaignName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isIncrease ? "bg-secondary/20" : "bg-amber-500/20"
          )}>
            <Icon className={cn("h-4 w-4", isIncrease ? "text-secondary" : "text-amber-500")} />
          </div>
          <h4 className="font-medium text-foreground">{recommendation.title}</h4>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>

        {/* Budget slider */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current: ${recommendation.currentValue}/day</span>
            <span className="text-primary font-medium">
              {isCustomMode ? `Custom: $${customBudget}/day` : `Recommended: $${recommendation.recommendedValue}/day`}
            </span>
          </div>
          
          {isCustomMode && (
            <div className="space-y-2">
              <Slider
                value={[customBudget]}
                onValueChange={([value]) => setCustomBudget(value)}
                min={10}
                max={200}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$10/day</span>
                <span>$200/day</span>
              </div>
            </div>
          )}
        </div>

        {/* Projected impact */}
        {recommendation.projectedImpact && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Projected Impact</p>
            {recommendation.projectedImpact.map((impact, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{impact.label}</span>
                <span className="font-medium text-foreground">{impact.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border/50 flex flex-wrap gap-2">
        <Button 
          size="sm" 
          className="flex-1"
          onClick={() => onAction(recommendation.id, 'apply', isCustomMode ? customBudget : recommendation.recommendedValue)}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          {isCustomMode ? 'Apply Custom' : 'Apply'}
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setIsCustomMode(!isCustomMode)}
        >
          {isCustomMode ? 'Use Recommended' : 'Customize'}
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onAction(recommendation.id, 'remind')}
        >
          <Clock className="h-4 w-4 mr-1" />
          Later
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => onAction(recommendation.id, 'dismiss')}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};
