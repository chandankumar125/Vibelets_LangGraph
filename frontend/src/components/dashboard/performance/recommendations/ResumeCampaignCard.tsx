import { AIRecommendation } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Play, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ResumeCampaignCardProps {
  recommendation: AIRecommendation;
  onAction: (recommendationId: string, action: string, value?: number) => void;
}

export const ResumeCampaignCard = ({ recommendation, onAction }: ResumeCampaignCardProps) => {
  const [resumeOption, setResumeOption] = useState<'previous' | 'conservative' | 'custom'>('previous');
  const previousBudget = recommendation.recommendedValue || 75;
  const conservativeBudget = Math.round(previousBudget * 0.8);

  const getPriorityColor = () => {
    switch (recommendation.priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSelectedBudget = () => {
    switch (resumeOption) {
      case 'previous': return previousBudget;
      case 'conservative': return conservativeBudget;
      default: return previousBudget;
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
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Paused Campaign
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <Play className="h-4 w-4 text-secondary" />
          </div>
          <h4 className="font-medium text-foreground">{recommendation.title}</h4>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>

        {/* Campaign info */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium text-foreground mb-2">{recommendation.campaignName}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Previous Budget</span>
              <p className="font-medium text-foreground">${previousBudget}/day</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium text-amber-500">Paused</p>
            </div>
          </div>
        </div>

        {/* Resume options */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Resume with budget:</p>
          <RadioGroup value={resumeOption} onValueChange={(v) => setResumeOption(v as typeof resumeOption)}>
            <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent/50">
              <RadioGroupItem value="previous" id="previous" />
              <Label htmlFor="previous" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">Previous Budget</span>
                <span className="text-xs text-muted-foreground ml-2">${previousBudget}/day</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent/50">
              <RadioGroupItem value="conservative" id="conservative" />
              <Label htmlFor="conservative" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">Conservative (-20%)</span>
                <span className="text-xs text-muted-foreground ml-2">${conservativeBudget}/day</span>
              </Label>
            </div>
          </RadioGroup>
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
          onClick={() => onAction(recommendation.id, 'resume', getSelectedBudget())}
        >
          <Play className="h-4 w-4 mr-1" />
          Resume Campaign
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => onAction(recommendation.id, 'dismiss')}
        >
          Not Now
        </Button>
      </div>
    </div>
  );
};
