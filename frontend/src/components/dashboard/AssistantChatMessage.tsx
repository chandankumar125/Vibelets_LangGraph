import { Bot, User, ArrowRight } from 'lucide-react';
import { AssistantMessage } from '@/hooks/useAssistantChat';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface AssistantChatMessageProps {
  message: AssistantMessage;
  onNavigateToStep?: (step: string) => void;
}

export const AssistantChatMessage = ({ message, onNavigateToStep }: AssistantChatMessageProps) => {
  const isAssistant = message.role === 'assistant';

  const handleActionClick = async (action: any) => {
    if (action.step) {
      // Navigate to workflow step
      if (onNavigateToStep) {
        onNavigateToStep(action.step);
      } else {
        // Use API to navigate
        try {
          await api.navigate('go_to_step', action.step);
          // Reload the page to reflect the new step
          window.location.reload();
        } catch (error) {
          console.error('Navigation failed:', error);
        }
      }
    } else if (action.action) {
      // Handle custom actions
      if (action.action.startsWith('mailto:')) {
        window.location.href = action.action;
      } else if (action.action === 'show_features') {
        // Could open a features modal or navigate to features page
        console.log('Show features');
      } else if (action.action === 'show_facebook_guide') {
        // Could open Facebook guide
        console.log('Show Facebook guide');
      }
    }
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold text
      let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <p key={i} className="pl-2 py-0.5" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }

      // Emoji lines (numbered steps)
      if (/^[0-9️⃣]/.test(line.trim()) || /^[🎯📦✍️🎬🚀💡🆓💼🏢📧💬📚]/.test(line.trim())) {
        return (
          <p key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }

      // Regular paragraphs
      if (line.trim()) {
        return (
          <p key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }

      return <br key={i} />;
    });
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300",
        isAssistant ? "bg-transparent" : "bg-transparent"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isAssistant
            ? "bg-primary/10 text-primary"
            : "bg-secondary/20 text-secondary"
        )}
      >
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "rounded-2xl px-4 py-3 max-w-[95%] backdrop-blur-sm",
            isAssistant
              ? "bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-tl-sm"
              : "bg-secondary/30 dark:bg-secondary/20 border border-secondary/20 rounded-tr-sm ml-auto"
          )}
        >
          <div className="text-sm leading-relaxed text-foreground space-y-1">
            {renderContent(message.content)}
          </div>


          {/* Suggested Actions */}
          {isAssistant && message.suggestedActions && message.suggestedActions.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Quick Actions
              </p>
              <div className="flex flex-col gap-2">
                {message.suggestedActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleActionClick(action)}
                    className="justify-between group hover:bg-primary/10 hover:border-primary/30 transition-all"
                  >
                    <span className="text-xs">{action.label}</span>
                    <ArrowRight className="h-3 w-3 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className={cn(
          "text-[10px] text-muted-foreground mt-1 px-1",
          !isAssistant && "text-right"
        )}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};
