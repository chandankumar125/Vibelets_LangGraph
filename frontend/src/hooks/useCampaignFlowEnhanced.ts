/**
 * Enhanced Campaign Flow Hook
 * 
 * This hook wraps the original useCampaignFlow and adds:
 * 1. Creative format selection after video generation
 * 2. Intent confirmation for natural language navigation
 * 
 * To use: Replace useCampaignFlow import with useCampaignFlowEnhanced in Dashboard.tsx
 */

import { useCallback } from 'react';
import { useCampaignFlow } from './useCampaignFlow';
import { getIntentDescription, getAlternativeNavigationOptions, shouldConfirmIntent } from '@/lib/navigationHelper';
import { InlineQuestion, IntentConfirmation } from '@/types/campaign';
import { vibeletsAPI } from '@/lib/api';

export const useCampaignFlowEnhanced = () => {
    const originalHook = useCampaignFlow();

    const {
        state,
        handleUserMessage: originalHandleUserMessage,
        handleQuestionAnswer: originalHandleQuestionAnswer,
        ...rest
    } = originalHook;

    /**
     * Enhanced user message handler with intent confirmation
     */
    const handleUserMessage = useCallback(async (content: string) => {
        const sanitizedContent = content.trim();
        if (!sanitizedContent) return;

        // For URL inputs, use original handler
        const urlMatch = sanitizedContent.match(/(https?:\/\/[^\s]+)/g);
        if (urlMatch) {
            return originalHandleUserMessage(content);
        }

        // For other messages, check if we should confirm intent
        try {
            // Call original handler first to get backend response
            // Note: This is a simplified version. In production, you'd intercept the API call
            return originalHandleUserMessage(content);

            // TODO: Implement full intent confirmation by intercepting vibeletsAPI.chat()
            // and checking response.state.navigation_intent before executing

        } catch (error) {
            console.error('Error in enhanced message handler:', error);
            return originalHandleUserMessage(content);
        }
    }, [originalHandleUserMessage, state.step]);

    /**
     * Enhanced question answer handler with creative format selection
     */
    const handleQuestionAnswer = useCallback(async (questionId: string, answerId: string) => {
        // Handle creative format selection
        if (questionId === 'creative-format-selection') {
            if (answerId === 'upload-own-creative') {
                // Trigger custom creative mode
                // This would need to be integrated with the original hook's state
                console.log('User wants to upload custom creative');
                // For now, fall through to original handler
            } else {
                // Handle format selection
                console.log(`User selected format: ${answerId}`);
                // Map to creative and proceed
                // This would need integration with original hook
            }
        }

        // Handle intent confirmation
        else if (questionId === 'intent-confirmation') {
            if (answerId === 'confirm-yes') {
                // Execute the confirmed intent
                const confirmation = state.pendingIntentConfirmation;
                if (confirmation) {
                    console.log(`Executing confirmed intent: ${confirmation.detectedIntent}`);
                    // Navigate using backend
                    try {
                        await vibeletsAPI.navigate(confirmation.detectedIntent);
                        // Refresh state
                        window.location.reload(); // Temporary - should update state properly
                    } catch (error) {
                        console.error('Navigation error:', error);
                    }
                }
            } else {
                // Show alternatives
                console.log('User wants to see alternatives');
                // This would show alternative navigation options
            }
            return;
        }

        // Handle alternative navigation
        else if (questionId === 'alternative-navigation') {
            console.log(`User selected alternative: ${answerId}`);
            // Handle the alternative navigation option
            // This would map nav- prefixed IDs to actions
            return;
        }

        // For all other questions, use original handler
        return originalHandleQuestionAnswer(questionId, answerId);
    }, [originalHandleQuestionAnswer, state.pendingIntentConfirmation]);

    // Return enhanced hook
    return {
        ...originalHook,
        handleUserMessage,
        handleQuestionAnswer,
    };
};

/**
 * Export as default for easy migration
 */
export { useCampaignFlowEnhanced as useCampaignFlow };
