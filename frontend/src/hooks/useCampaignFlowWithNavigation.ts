import { useCallback } from 'react';
import { useCampaignFlow as useOriginalCampaignFlow } from './useCampaignFlow';
import { looksLikeUrl } from '@/lib/nlpMatcher';
import { vibeletsAPI } from '@/lib/api';

/**
 * Enhanced campaign flow hook that uses BACKEND navigation logic
 * The backend has a NavigationAgent (GPT-4 powered) that intelligently
 * determines navigation intent - much smarter than frontend hardcoded patterns!
 */
export const useCampaignFlowWithNavigation = () => {
    const originalHook = useOriginalCampaignFlow();

    const {
        state,
        handleUserMessage: originalHandleUserMessage,
        ...rest
    } = originalHook;

    /**
     * Enhanced user message handler that leverages backend NavigationAgent
     */
    const handleUserMessage = useCallback(async (message: string) => {
        const input = message.trim();

        // 1. If it's clearly a URL, pass through immediately
        if (looksLikeUrl(input)) {
            return originalHandleUserMessage(input);
        }

        // 2. For all other inputs, let the BACKEND NavigationAgent decide
        // The backend has a GPT-4 powered agent that:
        // - Understands natural language navigation ("go to scripts", "back", "next")
        // - Determines if user wants to refine current step or move forward
        // - Handles context-aware navigation based on current step
        // - Much smarter than frontend pattern matching!

        try {
            // Send message to backend - it will use NavigationAgent to determine intent
            // and route appropriately through the workflow graph
            const response = await vibeletsAPI.chat(input);

            // Backend handles navigation and returns appropriate response
            // The workflow graph uses NavigationAgent.analyze_intent() to decide:
            // - "next" → move to next step
            // - "stay" → refine current step
            // - "step_name" → jump to specific step
            // - "complete" → finish workflow

            // The response will update state through the normal flow
            // No need for frontend navigation logic!

            return response;
        } catch (error) {
            console.error('Error sending message to backend:', error);
            // Fallback to original handler if backend fails
            return originalHandleUserMessage(input);
        }
    }, [originalHandleUserMessage]);

    // Return enhanced hook that uses backend navigation
    return {
        ...originalHook,
        handleUserMessage,
    };
};

/**
 * Export as default for easy migration
 */
export { useCampaignFlowWithNavigation as useCampaignFlow };
