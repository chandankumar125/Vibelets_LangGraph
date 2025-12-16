import { Sparkles, Zap, Target, TrendingUp } from 'lucide-react';

export const WelcomePanel = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Vibelets</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Create high-converting ad campaigns in minutes. Just paste your product URL and let AI do the heavy lifting.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <Zap className="w-6 h-6 text-primary mb-2 mx-auto" />
          <h3 className="font-medium text-foreground text-sm">Lightning Fast</h3>
          <p className="text-xs text-muted-foreground mt-1">From URL to live ad in under 5 minutes</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <Target className="w-6 h-6 text-primary mb-2 mx-auto" />
          <h3 className="font-medium text-foreground text-sm">AI-Optimized</h3>
          <p className="text-xs text-muted-foreground mt-1">Smart targeting and creative generation</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <TrendingUp className="w-6 h-6 text-primary mb-2 mx-auto" />
          <h3 className="font-medium text-foreground text-sm">Performance Driven</h3>
          <p className="text-xs text-muted-foreground mt-1">Continuous optimization suggestions</p>
        </div>
      </div>

      <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20 max-w-md">
        <p className="text-sm text-foreground">
          <span className="font-medium">Quick tip:</span> Paste any product URL from your store and I'll extract all the details automatically.
        </p>
      </div>
    </div>
  );
};
