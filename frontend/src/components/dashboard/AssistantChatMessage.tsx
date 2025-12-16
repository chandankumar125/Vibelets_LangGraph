import { Bot, User } from 'lucide-react';
import { AssistantMessage } from '@/hooks/useAssistantChat';
import { cn } from '@/lib/utils';

interface AssistantChatMessageProps {
  message: AssistantMessage;
}

export const AssistantChatMessage = ({ message }: AssistantChatMessageProps) => {
  const isAssistant = message.role === 'assistant';

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
