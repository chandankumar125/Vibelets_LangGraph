import { Loader2, Rocket, Check, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PublishingPanelProps {
  isPublished: boolean;
  onCreateAnother: () => void;
}

export const PublishingPanel = ({ isPublished, onCreateAnother }: PublishingPanelProps) => {
  if (!isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center animate-pulse">
            <Rocket className="w-4 h-4 text-accent-foreground" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">Publishing Your Campaign</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Submitting your ad to Facebook for review. This usually takes a few seconds...
        </p>

        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-accent" />
            <span className="text-sm text-foreground">Creative uploaded</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-accent" />
            <span className="text-sm text-foreground">Campaign created</span>
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-foreground">Submitting to Facebook...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-secondary/20 flex items-center justify-center shadow-lg shadow-secondary/20">
          <PartyPopper className="w-12 h-12 text-secondary" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">Campaign Published! 🎉</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Your ad has been submitted to Facebook for review. You'll be notified once it's approved.
      </p>

      <div className="w-full max-w-sm space-y-3 mb-8">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/10">
          <Check className="w-5 h-5 text-accent" />
          <span className="text-sm text-foreground">Campaign submitted successfully</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">
            Review time: typically 24-48 hours
          </span>
        </div>
      </div>

      <div className="space-y-3 w-full max-w-sm">
        <Button variant="outline" className="w-full" disabled>
          View in Facebook Ads Manager
        </Button>
        <Button className="w-full" onClick={onCreateAnother}>
          Create Another Campaign
        </Button>
      </div>
    </div>
  );
};
