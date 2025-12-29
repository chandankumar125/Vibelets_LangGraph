// ================= CAMPAIGN STEPS =================

export type CampaignStep =
    | 'welcome'
    | 'product-url'
    | 'product-analysis'
    | 'script-selection'
    | 'script-generation'
    | 'script-refinement'
    | 'avatar-selection'
    | 'creative-generation'
    | 'creative-generation:images'
    | 'creative-generation:audio'
    | 'creative-generation:video'
    | 'creative-review'
    | 'campaign-setup'
    | 'facebook-integration'
    | 'ad-account-selection'
    | 'campaign-preview'
    | 'publishing'
    | 'published';

// ================= CHAT & QUESTIONS =================

export interface QuestionOption {
    id: string;
    label: string;
    description?: string;
    icon?: string;
}

export interface InlineQuestion {
    id: string;
    question: string;
    options: QuestionOption[];
    multiSelect?: boolean;
    metadata?: any;
    hideOptionsInChat?: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isTyping?: boolean;
    inlineQuestion?: InlineQuestion;
    stepId?: CampaignStep;
    showCampaignSlider?: boolean;
    showFacebookConnect?: boolean;
}

// ================= PRODUCT =================

export interface ProductVariant {
    name: string;
    value: string;
    available?: boolean;
    price?: string;
    sku?: string;
}

export interface ProductInsight {
    label: string;
    value: string;
    icon: string;
}

export interface ProductData {
    // Core
    title: string;
    price: string;
    description: string;
    sku: string;
    category?: string;
    url?: string;

    // Images (IMPORTANT)
    images: string[];              // normalized images (frontend should use this)
    downloaded_images?: string[];  // backend raw images
    main_image?: string;           // backend hero image
    pageScreenshot?: string;       // alias for main image

    // Variants
    variants?: ProductVariant[];
    variants_count?: number;

    // AI
    insights?: ProductInsight[];

    // Meta / Debug
    confidence?: number;
    raw_text?: string;
}

// ================= SCRIPTS =================

export interface ScriptOption {
    id: string;
    name: string;
    description: string;
    duration: string;
    style: string;

    body?: string;
    hook?: string;
    cta?: string;
    tone?: string;
    content?: string;

    isCustom?: boolean;
    customContent?: {
        headline: string;
        primaryText: string;
        description: string;
    };
}


// ================= AVATARS =================

export interface AvatarOption {
    id: string;
    name: string;
    image: string;
    videoPreview?: string;
    style: string;
}

// ================= CREATIVES =================

export interface CreativeOption {
    id: string;
    type: 'image' | 'video';
    thumbnail: string;
    videoUrl?: string;
    name: string;
    format?: 'feed' | 'story' | 'reel' | 'landscape';
    aspectRatio?: '1:1' | '4:5' | '9:16' | '1.91:1';
    isCustom?: boolean;
    file?: File;
}

// ================= CAMPAIGN CONFIG =================

export interface CampaignConfig {
    // Campaign Level
    campaignName: string;
    objective: string;
    budgetType: 'daily' | 'lifetime';

    // Ad Set Level
    adSetName: string;
    budgetAmount: string;
    duration: string;
    fbPixelId: string;
    fbPageId: string;

    // Ad Level
    adName: string;
    primaryText: string;
    cta: string;
    websiteUrl: string;
}

// ================= FACEBOOK =================

export interface AdAccount {
    id: string;
    name: string;
    status: string;
}

// ================= STEP INFO =================

export interface StepInfo {
    id: CampaignStep;
    label: string;
    shortLabel: string;
    completed: boolean;
    current: boolean;
}

// ================= PERFORMANCE =================

export type CampaignLifecycleStage = 'testing' | 'optimizing' | 'scaling';

export interface PerformanceMetric {
    id: string;
    label: string;
    value: number;
    previousValue: number;
    format: 'currency' | 'percentage' | 'number';
    trend: 'up' | 'down' | 'neutral';
}

export interface PerformanceChange {
    id: string;
    category: 'good' | 'attention' | 'steady' | 'action-taken';
    title: string;
    description: string;
    metric?: string;
    change?: string;
}

export interface PublishedCampaign {
    id: string;
    name: string;
    status: 'active' | 'paused' | 'learning';
    budget: string;
    lifecycleStage: CampaignLifecycleStage;
    stageProgress: number;
    stageDescription: string;
    metrics: PerformanceMetric[];
    changes: PerformanceChange[];
    createdAt: Date;
}

// ================= AI RECOMMENDATIONS =================

export type RecommendationPriority = 'high' | 'medium' | 'suggestion';
export type RecommendationType =
    | 'budget-increase'
    | 'budget-decrease'
    | 'pause-creative'
    | 'resume-campaign'
    | 'clone-creative';

export interface AIRecommendation {
    id: string;
    type: RecommendationType;
    priority: RecommendationPriority;
    campaignId: string;
    campaignName: string;
    title: string;
    reasoning: string;
    currentValue?: number;
    recommendedValue?: number;
    projectedImpact?: {
        label: string;
        value: string;
    }[];
    creative?: {
        id: string;
        name: string;
        thumbnail: string;
        metrics: { label: string; value: string }[];
    };
    targetCampaigns?: { id: string; name: string; recommended?: boolean }[];
    createdAt: Date;
}

// ================= DASHBOARD =================

export interface UnifiedMetrics {
    totalSpent: PerformanceMetric;
    profit: PerformanceMetric;
    roi: PerformanceMetric;
    conversions: PerformanceMetric;
    aov: PerformanceMetric;
    ctr: PerformanceMetric;
}

export interface PerformanceDashboardState {
    unifiedMetrics: UnifiedMetrics;
    publishedCampaigns: PublishedCampaign[];
    recommendations: AIRecommendation[];
    selectedCampaignId: string | null;
    isActionCenterOpen: boolean;
}

// ================= INTENT =================

export interface IntentConfirmation {
    id: string;
    originalMessage: string;
    detectedIntent: string;
    intentDescription: string;
    alternativeOptions?: QuestionOption[];
}

// ================= CAMPAIGN STATE =================

export interface CampaignState {
    step: CampaignStep;
    stepHistory: CampaignStep[];
    productUrl: string | null;
    productData: ProductData | null;

    selectedScript: ScriptOption | null;
    selectedAvatar: AvatarOption | null;

    creatives: CreativeOption[];
    selectedCreative: CreativeOption | null;

    campaignConfig: CampaignConfig | null;

    facebookConnected: boolean;
    selectedAdAccount: AdAccount | null;

    isStepLoading: boolean;
    isRegenerating: 'product' | 'scripts' | 'creatives' | null;

    isCustomScriptMode: boolean;
    isCustomCreativeMode: boolean;

    performanceDashboard: PerformanceDashboardState | null;
    isRefreshingDashboard: boolean;

    pendingIntentConfirmation: IntentConfirmation | null;

    video_aspect_ratio?: '1:1' | '4:5' | '9:16' | '1.91:1';
}
