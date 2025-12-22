/**
 * NAVIGATION HANDLER INTEGRATION GUIDE
 * 
 * This guide shows how to integrate the navigationHandler into useCampaignFlow.ts
 * to handle both NLP and quick action navigation properly.
 */

import { detectNavigationIntent, getNextStep, getPreviousStep, isNavigationAllowed, getStepDescription } from '@/lib/navigationHandler';
import { matchUserInputToOption, looksLikeUrl, looksLikeNavigation } from '@/lib/nlpMatcher';
import { CampaignStep } from '@/types/campaign';

/**
 * EXAMPLE: Enhanced message handler that supports navigation
 */
export const handleUserMessageWithNavigation = (
    userInput: string,
    currentStep: CampaignStep,
    stepHistory: CampaignStep[],
    completedSteps: CampaignStep[],
    activeQuestion: any,
    setState: (step: CampaignStep) => void
) => {
    const input = userInput.trim();

    // 1. Check if it's a URL (for product-url step)
    if (looksLikeUrl(input)) {
        // Handle as product URL
        return { type: 'url', value: input };
    }

    // 2. Check for navigation intent FIRST (before option matching)
    const navIntent = detectNavigationIntent(input, currentStep);

    if (navIntent.type === 'back') {
        const previousStep = getPreviousStep(currentStep, stepHistory);
        if (previousStep) {
            setState(previousStep);
            return { type: 'navigation', action: 'back', targetStep: previousStep };
        }
    }

    if (navIntent.type === 'next') {
        const nextStep = getNextStep(currentStep);
        if (nextStep && isNavigationAllowed(currentStep, nextStep, completedSteps)) {
            setState(nextStep);
            return { type: 'navigation', action: 'next', targetStep: nextStep };
        }
    }

    if (navIntent.type === 'step' && navIntent.targetStep) {
        if (isNavigationAllowed(currentStep, navIntent.targetStep, completedSteps)) {
            setState(navIntent.targetStep);
            return { type: 'navigation', action: 'goto', targetStep: navIntent.targetStep };
        } else {
            return {
                type: 'error',
                message: `Cannot navigate to ${getStepDescription(navIntent.targetStep)}. Please complete the required steps first.`
            };
        }
    }

    if (navIntent.type === 'action' && navIntent.action) {
        // Handle quick actions
        return { type: 'action', action: navIntent.action };
    }

    // 3. If there's an active question, try to match to an option
    if (activeQuestion) {
        const matchResult = matchUserInputToOption(input, activeQuestion);
        if (matchResult.matched && matchResult.optionId) {
            return { type: 'option', optionId: matchResult.optionId, confidence: matchResult.confidence };
        }
    }

    // 4. If nothing matched, return as general input
    return { type: 'general', value: input };
};

/**
 * EXAMPLE: Quick action handler
 */
export const handleQuickAction = (
    action: string,
    currentStep: CampaignStep,
    callbacks: {
        onRegenerate?: () => void;
        onCustom?: () => void;
        onSkip?: () => void;
        onEdit?: () => void;
        onDelete?: () => void;
        onSave?: () => void;
        onCancel?: () => void;
    }
) => {
    switch (action) {
        case 'regenerate':
            callbacks.onRegenerate?.();
            break;
        case 'custom':
            callbacks.onCustom?.();
            break;
        case 'skip':
            callbacks.onSkip?.();
            break;
        case 'edit':
            callbacks.onEdit?.();
            break;
        case 'delete':
            callbacks.onDelete?.();
            break;
        case 'save':
            callbacks.onSave?.();
            break;
        case 'cancel':
            callbacks.onCancel?.();
            break;
        default:
            console.warn(`Unknown action: ${action}`);
    }
};

/**
 * EXAMPLE: Integration in useCampaignFlow.ts
 */
/*
const handleUserMessage = useCallback((message: string) => {
  const result = handleUserMessageWithNavigation(
    message,
    state.step,
    state.stepHistory,
    getCompletedSteps(state),
    activeQuestion,
    (newStep) => {
      setState(prev => ({
        ...prev,
        step: newStep,
        stepHistory: [...prev.stepHistory, newStep]
      }));
    }
  );

  switch (result.type) {
    case 'url':
      // Handle product URL
      handleProductUrl(result.value);
      break;

    case 'navigation':
      // Navigation already handled by setState in the handler
      addMessage({
        role: 'assistant',
        content: `Navigating to ${getStepDescription(result.targetStep!)}...`
      });
      break;

    case 'action':
      // Handle quick action
      handleQuickAction(result.action!, state.step, {
        onRegenerate: () => regenerateContent(state.step),
        onCustom: () => enableCustomMode(state.step),
        onSkip: () => goToNextStep(),
        // ... other callbacks
      });
      break;

    case 'option':
      // Handle option selection
      handleOptionSelection(result.optionId!, result.confidence);
      break;

    case 'error':
      // Show error message
      addMessage({
        role: 'assistant',
        content: result.message!
      });
      break;

    case 'general':
      // Handle as general input (send to backend for processing)
      processGeneralInput(result.value);
      break;
  }
}, [state, activeQuestion]);
*/

/**
 * EXAMPLE: Get completed steps helper
 */
export const getCompletedSteps = (state: any): CampaignStep[] => {
    const completed: CampaignStep[] = [];

    if (state.productUrl) completed.push('product-url');
    if (state.productData) completed.push('product-analysis');
    if (state.selectedScript) completed.push('script-selection');
    if (state.selectedAvatar) completed.push('avatar-selection');
    if (state.creatives.length > 0) completed.push('creative-generation');
    if (state.selectedCreative) completed.push('creative-review');
    if (state.campaignConfig) completed.push('campaign-setup');
    if (state.facebookConnected) completed.push('facebook-integration');
    if (state.selectedAdAccount) completed.push('ad-account-selection');

    return completed;
};

/**
 * EXAMPLE: Suggestion chips for current step
 */
export const getSuggestionChipsForStep = (step: CampaignStep): string[] => {
    const suggestions: Record<CampaignStep, string[]> = {
        'welcome': ['Get Started', 'View Demo'],
        'product-url': ['Paste URL', 'Example Product'],
        'product-analysis': ['Continue', 'Regenerate Analysis', 'Back'],
        'script-selection': ['First One', 'Custom Script', 'Regenerate'],
        'avatar-selection': ['First One', 'Next Step', 'Back'],
        'creative-generation': ['Generate', 'Skip'],
        'creative-review': ['Continue', 'Regenerate', 'Custom Upload'],
        'campaign-setup': ['Save & Continue', 'Back'],
        'facebook-integration': ['Connect Facebook', 'Skip'],
        'ad-account-selection': ['Continue', 'Back'],
        'campaign-preview': ['Publish', 'Edit Campaign', 'Back'],
        'publishing': ['View Dashboard'],
        'published': ['Create New Campaign', 'View Details'],
        'creative-generation:images': [],
        'creative-generation:audio': [],
        'creative-generation:video': []
    };

    return suggestions[step] || ['Next', 'Back'];
};

export default {
    handleUserMessageWithNavigation,
    handleQuickAction,
    getCompletedSteps,
    getSuggestionChipsForStep
};
