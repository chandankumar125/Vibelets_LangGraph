import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_MESSAGE_LENGTH = 2000;

export const ChatInput = ({ onSend, disabled, placeholder }: ChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      return;
    }
    
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      toast.error('Message too long', { 
        description: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters` 
      });
      return;
    }
    
    if (disabled) {
      toast.info('Please wait', { description: 'Processing your previous message...' });
      return;
    }
    
    try {
      onSend(trimmedInput);
      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message', { description: 'Please try again' });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH + 100) { // Allow some buffer for UX
      setInput(value);
    }
  };

  return (
    <div className="bg-background p-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Paste your product URL or type a message..."}
            disabled={disabled}
            className="min-h-[60px] max-h-[200px] resize-none pr-12 bg-muted/50 border-muted-foreground/20"
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH + 100}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
              <span className={`text-xs ${input.length > MAX_MESSAGE_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                {input.length}/{MAX_MESSAGE_LENGTH}
              </span>
            )}
            <Sparkles className="w-4 h-4 text-primary/50" />
          </div>
        </div>
        <Button 
          onClick={handleSend} 
          disabled={disabled || !input.trim() || input.length > MAX_MESSAGE_LENGTH}
          size="icon"
          className="h-[60px] w-[60px]"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Powered by Vibelets AI • Your data is secure and private
      </p>
    </div>
  );
};
