import { ScriptOption } from '@/types/campaign';
import { FileText, Clock, Sparkles, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScriptPreviewPanelProps {
  scripts: ScriptOption[];
  selectedScript: ScriptOption | null;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
}

export const ScriptPreviewPanel = ({ scripts, selectedScript, isRegenerating, onRegenerate }: ScriptPreviewPanelProps) => {
  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Script Styles</h2>
        <p className="text-sm text-muted-foreground">
          Choose a storytelling approach for your ad
        </p>
      </div>

      <div className={cn("space-y-4", isRegenerating && "opacity-50 pointer-events-none")}>
        {scripts.map((script) => {
          const isSelected = selectedScript?.id === script.id;
          return (
            <div
              key={script.id}
              className={cn(
                "p-4 rounded-xl border transition-all",
                isSelected 
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {isSelected ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-medium",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {script.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {script.description}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {script.duration}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted">
                      {script.style}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Regenerate option - subtle placement below scripts */}
      {onRegenerate && !selectedScript && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1.5", isRegenerating && "animate-spin")} />
            {isRegenerating ? 'Generating new scripts...' : 'Generate different scripts'}
          </Button>
        </div>
      )}
    </div>
  );
};
