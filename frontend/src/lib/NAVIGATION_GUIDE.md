# Navigation Handler - Complete Implementation Guide

## Overview

The navigation system now supports **both Natural Language Processing (NLP) and Quick Actions** with proper validation and context-aware navigation.

## Files Created

### 1. `navigationHandler.ts` - Core Navigation Logic
- **Purpose**: Central navigation system that handles all navigation intents
- **Features**:
  - Step-based navigation (e.g., "go to scripts", "show dashboard")
  - Back/Next navigation with history support
  - Step number navigation (e.g., "step 3")
  - Quick actions (regenerate, custom, skip, edit, etc.)
  - Context-aware suggestions
  - Navigation validation (prevents skipping required steps)

### 2. `navigationIntegrationGuide.ts` - Integration Examples
- **Purpose**: Shows how to integrate the navigation handler into `useCampaignFlow.ts`
- **Includes**:
  - Complete message handler example
  - Quick action handler
  - Suggestion chips generator
  - Completed steps tracker

## Key Features

### 1. **Natural Language Navigation**

Users can navigate using natural language:

```typescript
// Step navigation
"go to scripts" → script-selection
"show dashboard" → published
"campaign setup" → campaign-setup
"step 3" → script-selection

// Back/Next
"back" → previous step
"next" → next step
"previous step" → previous step

// Quick actions
"regenerate" → triggers regeneration
"custom" → enables custom mode
"skip" → skips to next step
```

### 2. **Context-Aware Navigation**

The system understands context:

```typescript
// On product-analysis step
"scripts" → goes to script-selection
"avatar" → goes to avatar-selection

// On script-selection step
"product" → goes back to product-analysis
"avatar" → goes to avatar-selection
```

### 3. **Navigation Validation**

Prevents users from skipping required steps:

```typescript
// Cannot go to creative-review without completing creative-generation
isNavigationAllowed(currentStep, targetStep, completedSteps)
```

### 4. **Quick Actions**

Supports common actions:
- `regenerate` - Regenerate current content
- `custom` - Create custom content
- `skip` - Skip to next step
- `edit` - Edit current content
- `delete` - Delete/clear content
- `save` - Save and continue
- `cancel` - Cancel current action

## Integration Steps

### Step 1: Import the Navigation Handler

```typescript
import { 
  detectNavigationIntent, 
  getNextStep, 
  getPreviousStep, 
  isNavigationAllowed,
  getStepDescription 
} from '@/lib/navigationHandler';
```

### Step 2: Update Message Handler

Replace your current message handler with the enhanced version:

```typescript
const handleUserMessage = useCallback((message: string) => {
  const input = message.trim();

  // 1. Check for URL
  if (looksLikeUrl(input)) {
    handleProductUrl(input);
    return;
  }

  // 2. Check for navigation intent
  const navIntent = detectNavigationIntent(input, state.step);
  
  if (navIntent.type === 'back') {
    const prevStep = getPreviousStep(state.step, state.stepHistory);
    if (prevStep) {
      navigateToStep(prevStep);
      return;
    }
  }

  if (navIntent.type === 'next') {
    const nextStep = getNextStep(state.step);
    if (nextStep) {
      navigateToStep(nextStep);
      return;
    }
  }

  if (navIntent.type === 'step' && navIntent.targetStep) {
    const completedSteps = getCompletedSteps(state);
    if (isNavigationAllowed(state.step, navIntent.targetStep, completedSteps)) {
      navigateToStep(navIntent.targetStep);
      return;
    } else {
      showError(`Please complete required steps before going to ${getStepDescription(navIntent.targetStep)}`);
      return;
    }
  }

  if (navIntent.type === 'action') {
    handleQuickAction(navIntent.action!);
    return;
  }

  // 3. Try to match to active question option
  if (activeQuestion) {
    const matchResult = matchUserInputToOption(input, activeQuestion);
    if (matchResult.matched) {
      handleOptionSelection(matchResult.optionId!);
      return;
    }
  }

  // 4. Send to backend for processing
  processGeneralInput(input);
}, [state, activeQuestion]);
```

### Step 3: Implement Helper Functions

```typescript
const navigateToStep = (step: CampaignStep) => {
  setState(prev => ({
    ...prev,
    step,
    stepHistory: [...prev.stepHistory, step]
  }));
  
  addMessage({
    role: 'assistant',
    content: `Navigating to ${getStepDescription(step)}...`
  });
};

const getCompletedSteps = (state: CampaignState): CampaignStep[] => {
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

const handleQuickAction = (action: string) => {
  switch (action) {
    case 'regenerate':
      regenerateCurrentContent();
      break;
    case 'custom':
      enableCustomMode();
      break;
    case 'skip':
      const nextStep = getNextStep(state.step);
      if (nextStep) navigateToStep(nextStep);
      break;
    case 'edit':
      enableEditMode();
      break;
    // ... other actions
  }
};
```

### Step 4: Add Suggestion Chips

```typescript
import { getSuggestionChipsForStep } from '@/lib/navigationIntegrationGuide';

const suggestionChips = getSuggestionChipsForStep(state.step);
```

## Usage Examples

### Example 1: User Types "go to scripts"

```
Input: "go to scripts"
↓
detectNavigationIntent() → { type: 'step', targetStep: 'script-selection', confidence: 'high' }
↓
isNavigationAllowed() → checks if product-analysis is completed
↓
navigateToStep('script-selection')
```

### Example 2: User Types "regenerate"

```
Input: "regenerate"
↓
detectNavigationIntent() → { type: 'action', action: 'regenerate', confidence: 'high' }
↓
handleQuickAction('regenerate')
↓
Triggers regeneration for current step
```

### Example 3: User Types "back"

```
Input: "back"
↓
detectNavigationIntent() → { type: 'back', confidence: 'high' }
↓
getPreviousStep() → returns previous step from history
↓
navigateToStep(previousStep)
```

### Example 4: User Types "step 5"

```
Input: "step 5"
↓
detectNavigationIntent() → { type: 'step', targetStep: 'creative-generation', confidence: 'high' }
↓
isNavigationAllowed() → validates dependencies
↓
navigateToStep('creative-generation') or showError()
```

## Supported Navigation Commands

### Step Navigation
- `"product"`, `"product url"`, `"enter product"`
- `"analysis"`, `"product analysis"`, `"insights"`
- `"script"`, `"scripts"`, `"choose script"`
- `"avatar"`, `"avatars"`, `"select avatar"`
- `"creative"`, `"generate"`, `"create"`
- `"review"`, `"preview"`, `"creative review"`
- `"campaign"`, `"campaign setup"`, `"settings"`
- `"facebook"`, `"connect facebook"`
- `"publish"`, `"launch"`, `"go live"`
- `"dashboard"`, `"performance"`, `"metrics"`

### Quick Navigation
- `"back"`, `"previous"`, `"go back"`
- `"next"`, `"continue"`, `"proceed"`
- `"step 1"` through `"step 9"`

### Quick Actions
- `"regenerate"`, `"try again"`, `"new"`
- `"custom"`, `"my own"`, `"write"`
- `"skip"`, `"pass"`, `"move on"`
- `"edit"`, `"change"`, `"modify"`
- `"save"`, `"confirm"`, `"done"`
- `"cancel"`, `"abort"`, `"stop"`

## Benefits

1. **Flexible Navigation**: Users can navigate using natural language or quick actions
2. **Context-Aware**: System understands context and suggests relevant next steps
3. **Validation**: Prevents users from skipping required steps
4. **User-Friendly**: Supports multiple ways to express the same intent
5. **Maintainable**: Centralized navigation logic, easy to extend
6. **Type-Safe**: Full TypeScript support with proper types

## Testing

Test the navigation system with these commands:

```typescript
// Test step navigation
"go to scripts"
"show dashboard"
"campaign setup"

// Test back/next
"back"
"next step"

// Test step numbers
"step 3"
"go to step 5"

// Test quick actions
"regenerate"
"custom"
"skip"

// Test context-aware navigation
// (on product-analysis step) "scripts" → should go to script-selection
// (on script-selection step) "product" → should go back to product-analysis
```

## Next Steps

1. Integrate the navigation handler into `useCampaignFlow.ts`
2. Add suggestion chips to the UI using `getSuggestionChipsForStep()`
3. Test all navigation commands
4. Add analytics to track which navigation methods users prefer
5. Extend with more context-aware patterns based on user behavior

## Notes

- The old `detectNavigationIntent` in `nlpMatcher.ts` is deprecated
- Use the new `detectNavigationIntent` from `navigationHandler.ts`
- The system is backward compatible with existing option matching
- Navigation validation ensures users don't skip required steps
- Step history is used for accurate back navigation
