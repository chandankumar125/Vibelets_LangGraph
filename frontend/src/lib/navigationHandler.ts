import { CampaignStep } from '@/types/campaign';

export interface NavigationIntent {
    type: 'step' | 'action' | 'back' | 'next' | 'none';
    targetStep?: CampaignStep;
    action?: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Step navigation patterns - maps natural language to specific steps
 */
const STEP_PATTERNS: Record<string, { patterns: RegExp[]; step: CampaignStep }> = {
    welcome: {
        patterns: [/^(home|start|beginning|welcome|restart|start over)$/i],
        step: 'welcome'
    },
    productUrl: {
        patterns: [
            /^(product|product url|enter product|add product|paste url|url|link)$/i,
            /^(go to product|show product|product page)$/i
        ],
        step: 'product-url'
    },
    productAnalysis: {
        patterns: [
            /^(analysis|analyze|product analysis|show analysis|view analysis)$/i,
            /^(insights|product insights|ai insights)$/i
        ],
        step: 'product-analysis'
    },
    scriptSelection: {
        patterns: [
            /^(script|scripts|choose script|select script|script selection)$/i,
            /^(ad copy|copy|text|messaging)$/i
        ],
        step: 'script-selection'
    },
    scriptRefinement: {
        patterns: [
            /^(refine|refine script|edit script|script refinement|refine scripts)$/i,
            /^(improve|improve script|modify script|customize script|change script)$/i,
            /^(diff|difference|compare|script diff)$/i
        ],
        step: 'script-refinement'
    },
    avatarSelection: {
        patterns: [
            /^(avatar|avatars|choose avatar|select avatar|avatar selection)$/i,
            /^(spokesperson|presenter|character)$/i
        ],
        step: 'avatar-selection'
    },
    creativeGeneration: {
        patterns: [
            /^(generate|create|make|creative generation|generate creative)$/i,
            /^(video|image|media|content generation)$/i
        ],
        step: 'creative-generation'
    },
    creativeReview: {
        patterns: [
            /^(review|preview|creative review|see creative|view creative)$/i,
            /^(gallery|creatives|creative gallery)$/i
        ],
        step: 'creative-review'
    },
    campaignSetup: {
        patterns: [
            /^(campaign|campaign setup|setup|configure|settings)$/i,
            /^(budget|targeting|schedule)$/i
        ],
        step: 'campaign-setup'
    },
    facebookIntegration: {
        patterns: [
            /^(facebook|connect facebook|fb|facebook integration|social)$/i,
            /^(connect|integration|link account)$/i
        ],
        step: 'facebook-integration'
    },
    adAccountSelection: {
        patterns: [
            /^(ad account|account|select account|choose account)$/i,
            /^(facebook account|fb account)$/i
        ],
        step: 'ad-account-selection'
    },
    campaignPreview: {
        patterns: [
            /^(preview|summary|campaign preview|final preview|review campaign)$/i,
            /^(overview|details|final check)$/i
        ],
        step: 'campaign-preview'
    },
    publishing: {
        patterns: [
            /^(publish|launch|go live|deploy|submit)$/i,
            /^(send|post|activate)$/i
        ],
        step: 'publishing'
    },
    published: {
        patterns: [
            /^(dashboard|performance|metrics|stats|analytics)$/i,
            /^(results|campaigns|published|live campaigns)$/i
        ],
        step: 'published'
    }
};

/**
 * Quick action patterns - common actions users might want to take
 */
const ACTION_PATTERNS: Record<string, RegExp[]> = {
    regenerate: [
        /^(regenerate|redo|try again|generate again|new|different|another)$/i,
        /^(refresh|reload|remake)$/i
    ],
    custom: [
        /^(custom|my own|write|upload|create my own|manual)$/i,
        /^(i'?ll (write|create|make|upload))$/i
    ],
    skip: [
        /^(skip|skip this|pass|move on|next|continue)$/i
    ],
    edit: [
        /^(edit|change|modify|update|customize)$/i
    ],
    delete: [
        /^(delete|remove|clear|reset)$/i
    ],
    save: [
        /^(save|keep|confirm|accept|done)$/i
    ],
    cancel: [
        /^(cancel|abort|stop|nevermind|back out)$/i
    ]
};

/**
 * Detects navigation intent from user input
 * Handles both step navigation and quick actions
 */
export const detectNavigationIntent = (input: string, currentStep?: CampaignStep): NavigationIntent => {
    const normalized = input.toLowerCase().trim();

    // 1. Check for back/next navigation
    const backPatterns = /^(back|go back|previous|previous step|return|last step|step back)$/i;
    const nextPatterns = /^(next|next step|forward|go forward|proceed|continue)$/i;

    if (backPatterns.test(normalized)) {
        return { type: 'back', confidence: 'high' };
    }
    if (nextPatterns.test(normalized)) {
        return { type: 'next', confidence: 'high' };
    }

    // 2. Check for specific step navigation (high confidence)
    for (const [key, { patterns, step }] of Object.entries(STEP_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(normalized)) {
                return { type: 'step', targetStep: step, confidence: 'high' };
            }
        }
    }

    // 3. Check for step number navigation (e.g., "step 3", "go to step 5")
    const stepNumberMatch = normalized.match(/^(?:go to |jump to |step )?step\s*(\d+)$/i);
    if (stepNumberMatch) {
        const stepNumber = parseInt(stepNumberMatch[1]);
        const stepMap: Record<number, CampaignStep> = {
            1: 'product-url',
            2: 'product-analysis',
            3: 'script-selection',
            4: 'avatar-selection',
            5: 'creative-generation',
            6: 'creative-review',
            7: 'campaign-setup',
            8: 'campaign-preview',
            9: 'publishing'
        };

        if (stepMap[stepNumber]) {
            return { type: 'step', targetStep: stepMap[stepNumber], confidence: 'high' };
        }
    }

    // 4. Check for quick actions
    for (const [action, patterns] of Object.entries(ACTION_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(normalized)) {
                return { type: 'action', action, confidence: 'high' };
            }
        }
    }

    // 5. Context-aware partial matches (medium confidence)
    if (currentStep) {
        // If user says "scripts" while on product-analysis, they likely want to go to script-selection
        const contextualMatches: Partial<Record<CampaignStep, { keywords: string[]; targetStep: CampaignStep }[]>> = {
            'product-analysis': [
                { keywords: ['script', 'copy', 'text'], targetStep: 'script-selection' },
                { keywords: ['avatar', 'spokesperson'], targetStep: 'avatar-selection' }
            ],
            'script-selection': [
                { keywords: ['avatar', 'spokesperson', 'presenter'], targetStep: 'avatar-selection' },
                { keywords: ['product', 'analysis', 'insights'], targetStep: 'product-analysis' }
            ],
            'avatar-selection': [
                { keywords: ['creative', 'generate', 'video'], targetStep: 'creative-generation' },
                { keywords: ['script', 'copy'], targetStep: 'script-selection' }
            ],
            'creative-review': [
                { keywords: ['campaign', 'setup', 'budget'], targetStep: 'campaign-setup' },
                { keywords: ['generate', 'create'], targetStep: 'creative-generation' }
            ]
        };

        const contextMatches = contextualMatches[currentStep];
        if (contextMatches) {
            for (const { keywords, targetStep } of contextMatches) {
                if (keywords.some(keyword => normalized.includes(keyword))) {
                    return { type: 'step', targetStep, confidence: 'medium' };
                }
            }
        }
    }

    return { type: 'none', confidence: 'low' };
};

/**
 * Gets the next step in the workflow
 */
export const getNextStep = (currentStep: CampaignStep): CampaignStep | null => {
    const stepOrder: CampaignStep[] = [
        'welcome',
        'product-url',
        'product-analysis',
        'script-selection',
        'avatar-selection',
        'creative-generation',
        'creative-review',
        'campaign-setup',
        'facebook-integration',
        'ad-account-selection',
        'campaign-preview',
        'publishing',
        'published'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
        return stepOrder[currentIndex + 1];
    }
    return null;
};

/**
 * Gets the previous step in the workflow
 */
export const getPreviousStep = (currentStep: CampaignStep, stepHistory?: CampaignStep[]): CampaignStep | null => {
    // If we have step history, use it for more accurate back navigation
    if (stepHistory && stepHistory.length > 1) {
        return stepHistory[stepHistory.length - 2];
    }

    // Otherwise, use the standard order
    const stepOrder: CampaignStep[] = [
        'welcome',
        'product-url',
        'product-analysis',
        'script-selection',
        'avatar-selection',
        'creative-generation',
        'creative-review',
        'campaign-setup',
        'facebook-integration',
        'ad-account-selection',
        'campaign-preview',
        'publishing',
        'published'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
        return stepOrder[currentIndex - 1];
    }
    return null;
};

/**
 * Checks if navigation to a target step is allowed from the current step
 */
export const isNavigationAllowed = (
    currentStep: CampaignStep,
    targetStep: CampaignStep,
    completedSteps: CampaignStep[]
): boolean => {
    // Always allow going back to completed steps
    if (completedSteps.includes(targetStep)) {
        return true;
    }

    // Define step dependencies
    const dependencies: Partial<Record<CampaignStep, CampaignStep[]>> = {
        'product-analysis': ['product-url'],
        'script-selection': ['product-analysis'],
        'avatar-selection': ['script-selection'],
        'creative-generation': ['avatar-selection'],
        'creative-review': ['creative-generation'],
        'campaign-setup': ['creative-review'],
        'facebook-integration': ['campaign-setup'],
        'ad-account-selection': ['facebook-integration'],
        'campaign-preview': ['ad-account-selection'],
        'publishing': ['campaign-preview']
    };

    // Check if all dependencies are met
    const requiredSteps = dependencies[targetStep] || [];
    return requiredSteps.every(step => completedSteps.includes(step));
};

/**
 * Gets a human-readable description of a step
 */
export const getStepDescription = (step: CampaignStep): string => {
    const descriptions: Record<CampaignStep, string> = {
        'welcome': 'Welcome screen',
        'product-url': 'Enter product URL',
        'product-analysis': 'Product analysis and insights',
        'script-selection': 'Choose ad script',
        'script-generation': 'Generate ad script',
        'avatar-selection': 'Select avatar/spokesperson',
        'creative-generation': 'Generate creative assets',
        'creative-generation:images': 'Generate images',
        'creative-generation:audio': 'Generate audio',
        'creative-generation:video': 'Generate video',
        'creative-review': 'Review generated creatives',
        'campaign-setup': 'Configure campaign settings',
        'facebook-integration': 'Connect Facebook account',
        'ad-account-selection': 'Select ad account',
        'campaign-preview': 'Preview campaign',
        'publishing': 'Publish campaign',
        'published': 'Performance dashboard'
    };

    return descriptions[step] || step;
};
