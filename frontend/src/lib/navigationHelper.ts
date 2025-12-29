import { CampaignStep, QuestionOption } from '@/types/campaign';

/**
 * Get human-readable description of navigation intent
 */
export function getIntentDescription(intent: string, currentStep: CampaignStep): string {
    const descriptions: Record<string, string> = {
        // Frontend step names
        'scrape': 'Start over with a new product URL',
        'analyze': 'Go back to product analysis',
        'generate_scripts': 'Go back to script generation',
        'script-selection': 'Go back to script selection',
        'select_script': 'Choose a different script',
        'refine_script': 'Refine the selected script',
        'avatar-selection': 'Go back to avatar selection',
        'select_avatar': 'Choose a different avatar',
        'generate_images': 'Generate new images for your ad',
        'generate_audio': 'Create the voiceover audio',
        'generate_video': 'Finalize your AI video with the presenter',
        'refine_images': 'Fine-tune the visual style',
        'creative-review': 'Review and select your ad creative',
        'select_media': 'Select the best creative for your campaign',
        'campaign-setup': 'Configure your campaign settings',
        'refine_campaign': 'Adjust the campaign details',
        'facebook-integration': 'Go back to Facebook connection',
        'facebook_auth': 'Go back to Facebook connection',
        'ad-account-selection': 'Go back to ad account selection',
        'select_ad_account': 'Go back to ad account selection',
        'campaign-preview': 'Go back to campaign preview',
        'preview_campaign': 'Go back to campaign preview',
        'publish_campaign': 'Publish the campaign',
        'next': 'Continue to next step',
        'stay': 'Refine current step',
        'complete': 'Complete the workflow'
    };

    return descriptions[intent] || `Navigate to ${intent.replace(/_/g, ' ')}`;
}

/**
 * Get alternative navigation options based on current step
 */
export function getAlternativeNavigationOptions(currentStep: CampaignStep): QuestionOption[] {
    const options: QuestionOption[] = [];

    // Always available options
    options.push({
        id: 'nav-go-back',
        label: '← Go Back',
        description: 'Return to previous step'
    });

    options.push({
        id: 'nav-start-over',
        label: '🔄 Start Over',
        description: 'Begin with new product URL'
    });

    // Context-specific options based on current step
    switch (currentStep) {
        case 'facebook-integration':
            options.push({
                id: 'nav-connect-facebook',
                label: '🔗 Connect Facebook',
                description: 'Authenticate with Facebook'
            });
            options.push({
                id: 'nav-use-existing',
                label: '✅ Use Existing',
                description: 'Use saved connection'
            });
            break;

        case 'ad-account-selection':
            options.push({
                id: 'nav-select-account',
                label: '📊 Select Account',
                description: 'Choose ad account'
            });
            options.push({
                id: 'nav-reconnect-facebook',
                label: '🔄 Reconnect Facebook',
                description: 'Use different account'
            });
            break;

        case 'creative-review':
        case 'creative-generation':
        case 'creative-generation:images':
        case 'creative-generation:video':
            options.push({
                id: 'nav-regenerate-creative',
                label: '🎨 Regenerate Creative',
                description: 'Create new variations'
            });
            options.push({
                id: 'nav-upload-own',
                label: '📤 Upload My Own',
                description: 'Use custom creative'
            });
            break;

        case 'script-selection':
            options.push({
                id: 'select-script-1',
                label: '1️⃣ Script 1',
                description: 'Select Script 1'
            });
            options.push({
                id: 'select-script-2',
                label: '2️⃣ Script 2',
                description: 'Select Script 2'
            });
            options.push({
                id: 'select-script-3',
                label: '3️⃣ Script 3',
                description: 'Select Script 3'
            });
            options.push({
                id: 'nav-regenerate-scripts',
                label: '📝 Regenerate Scripts',
                description: 'Create new script options'
            });
            options.push({
                id: 'nav-custom-script',
                label: '✍️ Write My Own',
                description: 'Create custom ad copy'
            });
            break;

        case 'avatar-selection':
            options.push({
                id: 'nav-reload-avatars',
                label: '🎭 Reload Avatars',
                description: 'Refresh avatar list'
            });
            break;

        case 'product-analysis':
            options.push({
                id: 'nav-regenerate-analysis',
                label: '🔄 Regenerate Analysis',
                description: 'Get fresh AI insights'
            });
            options.push({
                id: 'nav-change-url',
                label: '🔗 Change URL',
                description: 'Analyze different product'
            });
            break;

        case 'campaign-setup':
        case 'campaign-preview':
            options.push({
                id: 'nav-edit-creative',
                label: '🎨 Change Creative',
                description: 'Select different creative'
            });
            options.push({
                id: 'nav-edit-script',
                label: '📝 Change Script',
                description: 'Select different script'
            });
            break;
    }

    return options;
}

/**
 * Check if an intent should trigger confirmation
 * (skip confirmation for 'next', 'stay', and 'complete')
 */
export function shouldConfirmIntent(intent: string): boolean {
    const skipConfirmation = ['next', 'stay', 'complete', 'scrape', 'product-url', 'change_url', 'new_url', 'start_over'];
    return !skipConfirmation.includes(intent);
}
