import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Message, CampaignStep, InlineQuestion } from '@/types/campaign';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { AssistantChatMessage } from './AssistantChatMessage';
import { SuggestionChips } from './SuggestionChips';
import { useAssistantChat, isGeneralQuery } from '@/hooks/useAssistantChat';
import { MessageCircle, X, Trash2, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatPanelProps {
  messages: Message[];
  isTyping: boolean;
  onSendMessage: (message: string) => void;
  onQuestionAnswer: (questionId: string, answerId: string) => void;
  onCampaignConfigComplete?: (config: Record<string, string>) => void;
  onFacebookConnect?: () => void;
  onFacebookUseExisting?: () => void;
  isFacebookConnected?: boolean;
  disabled?: boolean;
  threadTitle?: string;
  onThreadTitleChange?: (title: string) => void;
  currentStep?: CampaignStep;
  selectedAnswers?: Record<string, string>;
}

export const ChatPanel = ({ 
  messages, 
  isTyping, 
  onSendMessage, 
  onQuestionAnswer,
  onCampaignConfigComplete,
  onFacebookConnect,
  onFacebookUseExisting,
  isFacebookConnected,
  disabled,
  threadTitle = 'New Campaign',
  onThreadTitleChange,
  currentStep = 'welcome',
  selectedAnswers = {}
}: ChatPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const assistantScrollRef = useRef<HTMLDivElement>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(threadTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  const {
    messages: assistantMessages,
    isTyping: assistantIsTyping,
    sendMessage: sendAssistantMessage,
    clearChat: clearAssistantChat,
  } = useAssistantChat();

  // Focus input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Scroll campaign chat
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isTyping]);

  // Scroll assistant chat
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (assistantScrollRef.current && isAssistantOpen) {
        assistantScrollRef.current.scrollTo({
          top: assistantScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [assistantMessages, assistantIsTyping, isAssistantOpen]);

  // Find the active question that needs chip selection (last unanswered question)
  const activeQuestion: InlineQuestion | null = useMemo(() => {
    const chipQuestionIds = ['product-continue', 'script-selection', 'avatar-selection', 'creative-selection', 'ad-account-selection'];
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.inlineQuestion && chipQuestionIds.includes(msg.inlineQuestion.id)) {
        // Check if already answered
        if (!selectedAnswers[msg.inlineQuestion.id]) {
          return msg.inlineQuestion;
        }
      }
    }
    return null;
  }, [messages, selectedAnswers]);

  const handleChipSelect = useCallback((optionId: string) => {
    if (activeQuestion) {
      onQuestionAnswer(activeQuestion.id, optionId);
    }
  }, [activeQuestion, onQuestionAnswer]);

  const handleSendMessage = useCallback((message: string) => {
    // Intelligently route based on message content
    if (isGeneralQuery(message)) {
      setIsAssistantOpen(true);
      sendAssistantMessage(message);
    } else {
      setIsAssistantOpen(false);
      onSendMessage(message);
    }
  }, [onSendMessage, sendAssistantMessage]);

  const handleAssistantSend = useCallback((message: string) => {
    sendAssistantMessage(message);
  }, [sendAssistantMessage]);

  const handleSaveTitle = () => {
    if (editedTitle.trim() && onThreadTitleChange) {
      onThreadTitleChange(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(threadTitle);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header - No logo, editable title */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 flex-shrink-0 bg-background/30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleSaveTitle}
                className="h-8 text-sm font-semibold bg-muted/50 border-primary/30 focus-visible:ring-primary/30"
                maxLength={50}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={handleSaveTitle}
              >
                <Check className="h-4 w-4 text-secondary" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm text-foreground truncate">
                  {threadTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  AI-powered ad creation
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Campaign Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="flex flex-col">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              onQuestionAnswer={onQuestionAnswer}
              onCampaignConfigComplete={onCampaignConfigComplete}
              onFacebookConnect={onFacebookConnect}
              onFacebookUseExisting={onFacebookUseExisting}
              selectedAnswers={selectedAnswers}
              isFacebookConnected={isFacebookConnected}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Assistant Chat Overlay */}
      {isAssistantOpen && (
        <div className="absolute inset-0 top-[73px] bg-background/95 backdrop-blur-sm z-10 flex flex-col">
          {/* Assistant Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/50 bg-secondary/20">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium">Help & Support</span>
            </div>
            <div className="flex items-center gap-1">
              {assistantMessages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearAssistantChat}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsAssistantOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Assistant Messages */}
          <div 
            ref={assistantScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden p-4"
          >
            {assistantMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Ask me anything about Vibelets!</p>
                <p className="text-xs mt-1">e.g., "What is Vibelets?", "How does it work?"</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {assistantMessages.map((message) => (
                  <AssistantChatMessage key={message.id} message={message} />
                ))}
                {assistantIsTyping && <TypingIndicator />}
              </div>
            )}
          </div>

          {/* Assistant Input */}
          <div className="bg-background/30 p-3 border-t border-border/30">
            <ChatInput 
              onSend={handleAssistantSend} 
              disabled={assistantIsTyping}
              placeholder="Ask a question..."
            />
          </div>
        </div>
      )}

      {/* Suggestion Chips + Input Area */}
      <div className="flex-shrink-0 bg-background/30 relative">
        {/* Chat Icon Button */}
        <div className="absolute -top-12 right-4 z-20">
          <Button
            variant={isAssistantOpen ? "default" : "outline"}
            size="icon"
            className={`h-9 w-9 rounded-full shadow-lg transition-all ${
              isAssistantOpen 
                ? 'bg-secondary hover:bg-secondary/90 text-secondary-foreground' 
                : 'bg-background hover:bg-secondary/20 border-secondary/50'
            }`}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
          >
            <MessageCircle className={`h-4 w-4 ${isAssistantOpen ? '' : 'text-secondary'}`} />
          </Button>
        </div>

        {/* Floating Suggestion Chips */}
        <SuggestionChips
          activeQuestion={activeQuestion}
          onSelect={handleChipSelect}
          currentStep={currentStep}
          disabled={disabled || isTyping}
        />
        
        <ChatInput 
          onSend={handleSendMessage} 
          disabled={disabled || isTyping || assistantIsTyping} 
          placeholder="Paste product URL or type your choice..."
        />
      </div>
    </div>
  );
};
