import { Bot } from 'lucide-react';

export const TypingIndicator = () => {
  return (
    <div className="flex gap-3 p-4 bg-muted/30 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Vibelets AI</p>
        <div className="flex gap-1 items-center h-6">
          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
