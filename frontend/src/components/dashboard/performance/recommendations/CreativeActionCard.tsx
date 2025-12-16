import { AIRecommendation } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Pause, Copy, Clock, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CreativeActionCardProps {
  recommendation: AIRecommendation;
  onAction: (recommendationId: string, action: string, value?: number) => void;
}

export const CreativeActionCard = ({ recommendation, onAction }: CreativeActionCardProps) => {
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(
    recommendation.targetCampaigns?.filter(c => c.recommended).map(c => c.id) || []
  );

  const isPause = recommendation.type === 'pause-creative';
  const Icon = isPause ? Pause : Copy;

  const getPriorityColor = () => {
    switch (recommendation.priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const toggleCampaign = (campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
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
            isPause ? "bg-amber-500/20" : "bg-secondary/20"
          )}>
            <Icon className={cn("h-4 w-4", isPause ? "text-amber-500" : "text-secondary")} />
          </div>
          <h4 className="font-medium text-foreground">{recommendation.title}</h4>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>

        {/* Creative preview */}
        {recommendation.creative && (
          <div className="flex gap-3 bg-muted/50 rounded-lg p-3">
            <img 
              src={recommendation.creative.thumbnail} 
              alt={recommendation.creative.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{recommendation.creative.name}</p>
              <div className="mt-1 space-y-1">
                {recommendation.creative.metrics.map((metric, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{metric.label}</span>
                    <span className={cn(
                      "font-medium",
                      isPause ? "text-destructive" : "text-secondary"
                    )}>{metric.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Target campaigns for clone */}
        {!isPause && recommendation.targetCampaigns && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Clone to campaigns:</p>
            {recommendation.targetCampaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                onClick={() => toggleCampaign(campaign.id)}
              >
                <Checkbox 
                  checked={selectedCampaigns.includes(campaign.id)}
                  onCheckedChange={() => toggleCampaign(campaign.id)}
                />
                <span className="text-sm text-foreground">{campaign.name}</span>
                {campaign.recommended && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Recommended
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

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
        {isPause ? (
          <>
            <Button 
              size="sm" 
              className="flex-1 bg-amber-500 hover:bg-amber-600"
              onClick={() => onAction(recommendation.id, 'pause')}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause Now
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onAction(recommendation.id, 'wait')}
            >
              <Clock className="h-4 w-4 mr-1" />
              Give It 3 Days
            </Button>
          </>
        ) : (
          <>
            <Button 
              size="sm" 
              className="flex-1"
              disabled={selectedCampaigns.length === 0}
              onClick={() => onAction(recommendation.id, 'clone', selectedCampaigns.length)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Clone to Selected ({selectedCampaigns.length})
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onAction(recommendation.id, 'clone-all')}
            >
              Clone to All
            </Button>
          </>
        )}
        <Button 
          size="sm" 
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => onAction(recommendation.id, 'dismiss')}
        >
          Skip
        </Button>
      </div>
    </div>
  );
};
