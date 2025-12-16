import { AlertTriangle, ChevronRight } from 'lucide-react';
import { AIRecommendation } from '@/types/campaign';
import { Button } from '@/components/ui/button';

interface ActionRequiredBannerProps {
  recommendations: AIRecommendation[];
  onScrollToRecommendations: () => void;
}

export const ActionRequiredBanner = ({ 
  recommendations, 
  onScrollToRecommendations 
}: ActionRequiredBannerProps) => {
  const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
  
  if (highPriorityCount === 0) return null;

  return (
    <div className="mx-4 mb-4 animate-fade-in">
      <div className="glass-card rounded-xl p-4 border-l-4 border-l-amber-500 bg-amber-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {highPriorityCount} Action{highPriorityCount > 1 ? 's' : ''} Required
              </h3>
              <p className="text-xs text-muted-foreground">
                AI detected opportunities to improve your campaigns
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onScrollToRecommendations}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
          >
            Review Now
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
