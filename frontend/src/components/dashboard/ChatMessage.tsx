import { Message } from '@/types/campaign';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { InlineQuestionCard } from './InlineQuestionCard';
import { CampaignSetupSlider } from './CampaignSetupSlider';
import { FacebookAccountCard } from './FacebookAccountCard';

interface ChatMessageProps {
  message: Message;
  onQuestionAnswer?: (questionId: string, answerId: string) => void;
  onCampaignConfigComplete?: (config: Record<string, string>) => void;
  onFacebookConnect?: () => void;
  onFacebookUseExisting?: () => void;
  selectedAnswers?: Record<string, string>;
  isFacebookConnected?: boolean;
}

export const ChatMessage = ({ 
  message, 
  onQuestionAnswer, 
  onCampaignConfigComplete,
  onFacebookConnect,
  onFacebookUseExisting,
  selectedAnswers = {},
  isFacebookConnected
}: ChatMessageProps) => {
  const isAssistant = message.role === 'assistant';
  
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className={cn("break-words", i > 0 && "mt-2")} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('•') || part.startsWith('✅')) {
              return <span key={j} className="text-primary">{part}</span>;
            }
            return part;
          })}
        </p>
      );
    });
  };
  
  return (
    <div className={cn(
      "flex gap-3 p-4 animate-fade-in rounded-lg mx-2 my-1 transition-all duration-200 cursor-default",
      isAssistant 
        ? "bg-primary/5 dark:bg-primary/10 backdrop-blur-sm border border-primary/10 shadow-sm hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/20" 
        : "bg-secondary/30 dark:bg-secondary/20 backdrop-blur-sm border border-secondary/20 hover:shadow-md hover:shadow-secondary/20 hover:-translate-y-0.5 hover:border-secondary/30"
    )}>
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ring-2 ring-background/50",
        isAssistant 
          ? "bg-primary text-primary-foreground" 
          : "bg-secondary text-secondary-foreground"
      )}>
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {isAssistant ? 'Vibelets AI' : 'You'}
        </p>
        <div className="text-sm text-foreground leading-relaxed">
          {renderContent(message.content)}
        </div>
        {message.inlineQuestion && onQuestionAnswer && (
          <InlineQuestionCard
            question={message.inlineQuestion}
            onAnswer={onQuestionAnswer}
            selectedAnswer={selectedAnswers[message.inlineQuestion.id]}
          />
        )}
        {message.showCampaignSlider && onCampaignConfigComplete && (
          <CampaignSetupSlider onComplete={onCampaignConfigComplete} />
        )}
        {message.showFacebookConnect && onFacebookConnect && (
          <FacebookAccountCard 
            onConnect={onFacebookConnect} 
            onUseExisting={onFacebookUseExisting || onFacebookConnect}
            isConnected={isFacebookConnected} 
          />
        )}
      </div>
    </div>
  );
};
