import { AIRecommendation } from '@/types/campaign';
import { Sparkles, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AIActionsPreviewProps {
  recommendations: AIRecommendation[];
  onViewAll: () => void;
}

export const AIActionsPreview = ({ recommendations, onViewAll }: AIActionsPreviewProps) => {
  const highPriority = recommendations.filter(r => r.priority === 'high').length;
  const mediumPriority = recommendations.filter(r => r.priority === 'medium').length;
  const suggestions = recommendations.filter(r => r.priority === 'suggestion').length;

  if (recommendations.length === 0) {
    return (
      <div className="p-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">All optimized!</p>
              <p className="text-sm text-muted-foreground">No recommendations right now</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div 
        className="glass-card p-4 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onViewAll}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              highPriority > 0 ? "bg-destructive/20 animate-pulse" : "bg-secondary/20"
            )}>
              <Sparkles className={cn(
                "h-5 w-5",
                highPriority > 0 ? "text-destructive" : "text-secondary"
              )} />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {recommendations.length} AI Recommendation{recommendations.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {highPriority > 0 && (
                  <Badge variant="destructive" className="text-xs px-2 py-0 h-5">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {highPriority} High
                  </Badge>
                )}
                {mediumPriority > 0 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0 h-5 bg-primary/20 text-primary">
                    {mediumPriority} Medium
                  </Badge>
                )}
                {suggestions > 0 && (
                  <Badge variant="outline" className="text-xs px-2 py-0 h-5">
                    <Info className="h-3 w-3 mr-1" />
                    {suggestions} Tip{suggestions !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-primary">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
