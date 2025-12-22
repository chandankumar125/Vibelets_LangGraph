import { useState, useCallback } from 'react';
import api from '@/lib/api';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedActions?: SuggestedAction[];
  confidence?: number;
}

export interface SuggestedAction {
  label: string;
  step?: string;  // Workflow step to navigate to
  action?: string; // Custom action
}

// Detect if a query is a general/RAG query vs campaign-related
export const isGeneralQuery = (message: string): boolean => {
  const messageLower = message.toLowerCase().trim();

  // Check for URL patterns (campaign intent)
  if (messageLower.includes('http') || messageLower.includes('www.') || messageLower.includes('.com')) {
    return false;
  }

  // Check for explicit navigation commands
  const navigationCommands = ['next', 'continue', 'back', 'previous', 'go to', 'start over'];
  if (navigationCommands.some(cmd => messageLower.includes(cmd))) {
    return false;
  }

  // Check for campaign-related keywords with action intent
  const campaignKeywords = ['campaign', 'publish', 'creative', 'script', 'avatar', 'budget'];
  const hasCampaignIntent = campaignKeywords.some(kw => messageLower.includes(kw));

  if (hasCampaignIntent && (messageLower.includes('create') || messageLower.includes('start') || messageLower.includes('make'))) {
    return false;
  }

  // General query patterns - more flexible matching
  const generalPatterns = [
    /what'?s?\\s*vibelets/i,
    /what\\s+(is|are)\\s+vibelets/i,
    /what\\s+(can|could).*(do|done)/i,
    /how\\s+(does|do).*(work|function)/i,
    /how\\s+to\\s+(use|start|begin)/i,
    /tell\\s+me\\s+(about|more)/i,
    /explain/i,
    /who\\s+are\\s+you/i,
    /what\\s+are\\s+you/i,
    /^help$/i,
    /help\\s+me/i,
    /pricing|price|cost/i,
    /support|contact/i,
    /features|about/i,
    /how\\s+(do|can)\\s+i/i,  // "how do I connect Facebook?"
    /where/i,
    /when/i,
  ];

  return generalPatterns.some(pattern => pattern.test(messageLower));
};

const createMessage = (role: 'user' | 'assistant', content: string, suggestedActions?: SuggestedAction[], confidence?: number): AssistantMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: new Date(),
  suggestedActions,
  confidence,
});

export const useAssistantChat = () => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isAssistantMode, setIsAssistantMode] = useState(false);

  const sendMessage = useCallback(async (content: string, preCalculatedAnswer?: any) => {
    const sanitizedContent = content.trim();
    if (!sanitizedContent) return;

    // Add user message
    setMessages(prev => [...prev, createMessage('user', sanitizedContent)]);

    // Simulate typing
    setIsTyping(true);

    try {
      let response;

      if (preCalculatedAnswer) {
        // Use provided answer
        response = preCalculatedAnswer;
        // Small delay for effect
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        // Call the real AI support API
        response = await api.post('/api/support/query', {
          question: sanitizedContent
        });

        // Wait a bit for natural feel
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setIsTyping(false);

      const fullContent = response.answer || "I'm sorry, I couldn't understand that.";
      const suggestedActions = response.suggested_actions || [];
      const confidence = response.confidence;

      // Create empty message first
      const messageId = crypto.randomUUID();
      const newMessage: AssistantMessage = {
        id: messageId,
        role: 'assistant',
        content: '', // Start empty
        timestamp: new Date(),
        suggestedActions,
        confidence
      };

      setMessages(prev => [...prev, newMessage]);

      // Typewriter effect logic
      let currentIndex = 0;
      const typeSpeed = 10; // Fast typing (10ms per char)

      const typeNextChar = () => {
        if (currentIndex < fullContent.length) {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, content: fullContent.substring(0, currentIndex + 1) }
              : msg
          ));
          currentIndex++;

          // Add slight variation for natural feel
          const delay = typeSpeed + (Math.random() * 5);
          setTimeout(typeNextChar, delay);
        }
      };

      // Start typing immediately
      typeNextChar();
    } catch (error) {
      console.error('Error getting support response:', error);
      setIsTyping(false);

      // Fallback response
      setMessages(prev => [...prev, createMessage(
        'assistant',
        `I'm here to help! I can assist you with:
• Platform questions about Vibelets
• Feature guidance and how-tos
• Troubleshooting and support

What would you like to know?`,
        [
          { label: "📚 View Features", action: "show_features" },
          { label: "🏠 Start New Campaign", step: "product-url" }
        ]
      )]);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsAssistantMode(false);
  }, []);

  return {
    messages,
    isTyping,
    sendMessage,
    clearChat,
    isAssistantMode,
    setIsAssistantMode,
  };
};
