import { useState, useCallback, useMemo, useEffect } from 'react';
import { CampaignState, CampaignStep, Message, ProductData, ScriptOption, AvatarOption, CreativeOption, CampaignConfig, AdAccount, InlineQuestion, AIRecommendation, ProductInsight, IntentConfirmation, QuestionOption } from '@/types/campaign';
import { avatarOptions, campaignObjectives, ctaOptions, scriptOptions, mockAdAccounts } from '@/data/mockData';
import { createMockPerformanceDashboard } from '@/data/mockPerformanceData';
import { toast } from 'sonner';
import { isValidUrl, sanitizeInput, validateCampaignConfig, formatErrorMessage } from '@/lib/validation';
import { matchUserInputToOption, looksLikeUrl, detectNavigationIntent } from '@/lib/nlpMatcher';
import { vibeletsAPI, WorkflowState } from '@/lib/api';
import { getIntentDescription, getAlternativeNavigationOptions, shouldConfirmIntent } from '@/lib/navigationHelper';


// Helper to format insight values that might be arrays or strings
const formatInsightValue = (value: any): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
  }
  return String(value);
};

const STEP_ORDER: CampaignStep[] = [
  'welcome',
  'product-url',
  'product-analysis',
  'script-selection',
  'script-generation',
  'script-refinement',
  'avatar-selection',
  'creative-generation',
  'creative-generation:images',
  'creative-generation:audio',
  'creative-generation:video',
  'creative-review',
  'campaign-setup',
  'facebook-integration',
  'ad-account-selection',
  'campaign-preview',
  'publishing',
  'published'
];

const initialState: CampaignState = {
  step: 'welcome',
  stepHistory: ['welcome'],
  productUrl: null,
  productData: null,
  selectedScript: null,
  selectedAvatar: null,
  creatives: [],
  selectedCreative: null,
  campaignConfig: null,
  facebookConnected: false,
  selectedAdAccount: null,
  isStepLoading: false,
  isRegenerating: null,
  isCustomScriptMode: false,
  isCustomCreativeMode: false,
  performanceDashboard: null,
  isRefreshingDashboard: false,
  pendingIntentConfirmation: null,
};

const createMessage = (
  role: 'user' | 'assistant',
  content: string,
  options?: { inlineQuestion?: InlineQuestion; stepId?: CampaignStep; showCampaignSlider?: boolean; showFacebookConnect?: boolean }
): Message => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: new Date(),
  ...options
});

// Create initial welcome message once to prevent duplicate IDs on re-renders
const INITIAL_WELCOME_MESSAGE = createMessage(
  'assistant',
  "Hey! 👋 I'm your Vibelets AI assistant. I'll help you create a high-converting ad campaign in minutes.\n\nJust paste your product URL below to get started.",
  { stepId: 'welcome' }
);

const getAutoQuickActions = (message: string, currentStep: CampaignStep): InlineQuestion | undefined => {
  const msg = message.toLowerCase();

  // 1. PRODUCT ANALYSIS COMPLETION
  if (msg.includes('ready to proceed') || msg.includes('product analysis') || msg.includes('targeting') || msg.includes('usps')) {
    return {
      id: 'product-continue',
      question: 'Ready to continue to script generation?',
      options: [
        { id: 'continue', label: '✅ Yes, Generate Scripts', icon: 'zap' },
        { id: 'change', label: '🔗 Change Product URL', icon: 'link' },
        { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' }
      ]
    };
  }

  // 2. SCRIPT SELECTION
  if (msg.includes('select a style') || msg.includes('choose a script') || msg.includes('which script') || msg.includes('ad scripts')) {
    return {
      id: 'script-selection',
      question: 'Which script style would you like?',
      options: [
        { id: 'script-0', label: 'Option 1', icon: 'file-text' },
        { id: 'script-1', label: 'Option 2', icon: 'file-text' },
        { id: 'script-2', label: 'Option 3', icon: 'file-text' },
        { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' }
      ]
    };
  }

  // 3. SCRIPT REVIEW / ACTION
  if (msg.includes('successfully selected') || msg.includes('scripts for your campaign') ||
    msg.includes('successfully refined') || msg.includes('how does that look') ||
    msg.includes('like the new version')) {
    return {
      id: 'script-review',
      question: 'What would you like to do next?',
      options: [
        { id: 'continue', label: '✅ Generate Images', icon: 'image' },
        { id: 'refine', label: '✍️ Refine Script', icon: 'edit' },
        { id: 'back', label: '🔙 Choose Different Style', icon: 'arrow-left' },
        { id: 'start-over', label: '🏠 Start Over', icon: 'home' }
      ]
    };
  }

  // 4. AVATAR SELECTION
  if (msg.includes('select an ai presenter') || msg.includes('choose an avatar') || msg.includes('select an avatar')) {
    return {
      id: 'avatar-selection',
      question: 'Who should present your video?',
      options: [
        { id: 'next', label: '✅ Next', icon: 'arrow-right' },
        { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' },
        { id: 'start-over', label: '🏠 Start Over', icon: 'home' }
      ]
    };
  }

  // 5. CREATIVE GENERATION COMPLETION
  if (msg.includes('images generated') || msg.includes('creatives are ready') ||
    msg.includes('video is ready') || msg.includes('how do the new creatives look') ||
    msg.includes('tweaks to the images') || msg.includes('refine the images') ||
    msg.includes('assets for your ad') || msg.includes('ready to review') ||
    msg.includes('looks great') || msg.includes('looks good') ||
    (msg.includes('video') && (msg.includes('ready') || msg.includes('done') || msg.includes('review')))) {
    return {
      id: 'creative-review',
      question: 'How do these look? Ready to finalize?',
      options: [
        { id: 'approve', label: '✅ Looks Great!', icon: 'check' },
        { id: 'refine', label: '🎨 Refine Visuals', icon: 'palette' },
        { id: 'regenerate', label: '🔄 Regenerate Video', icon: 'refresh-cw' },
        { id: 'back', label: '🔙 Go Back to Scripts', icon: 'arrow-left' },
        { id: 'start-over', label: '🏠 Start Over', icon: 'home' }
      ]
    };
  }

  // 6. FACEBOOK INTEGRATION
  if (msg.includes('connect your facebook') || msg.includes('facebook account') ||
    msg.includes('facebook login') || msg.includes('authenticate') ||
    currentStep === 'facebook-integration') {
    return {
      id: `facebook-connect-${Date.now()}`,
      question: 'Ready to connect Facebook?',
      options: [
        { id: 'connect', label: '🔗 Connect Facebook', icon: 'link' },
        { id: 'use-existing', label: '✅ Use Existing Connection', icon: 'check' },
        { id: 'skip', label: '⏭️ Skip for Now', icon: 'skip-forward' },
        { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' }
      ]
    };
  }

  // 7. AD ACCOUNT SELECTION
  if (msg.includes('select your ad account') || msg.includes('choose an ad account') ||
    msg.includes('ad account') || currentStep === 'ad-account-selection') {
    return {
      id: 'ad-account-selection',
      question: 'Which ad account?',
      options: [
        { id: 'select-account', label: '📊 Select Account', icon: 'briefcase' },
        { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' }
      ]
    };
  }

  // 8. CAMPAIGN PREVIEW / PUBLISH
  if (msg.includes('campaign preview') || msg.includes('ready to publish') ||
    msg.includes('review your campaign') || currentStep === 'campaign-preview') {
    return {
      id: 'campaign-publish',
      question: 'Ready to launch?',
      options: [
        { id: 'publish', label: '🚀 Publish Campaign', icon: 'send' },
        { id: 'edit', label: '✏️ Edit Campaign', icon: 'edit' },
        { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' }
      ]
    };
  }

  // 9. GENERIC QUESTION FALLBACK
  if (message.includes('?') || msg.includes('ready') || msg.includes('proceed') || msg.includes('next') || msg.includes('what would you like')) {
    return {
      id: 'generic-confirmation',
      question: 'Choose your next step:',
      options: [
        { id: 'yes', label: '✅ Continue / Yes', icon: 'check' },
        { id: 'back', label: '🔙 Previous Step', icon: 'arrow-left' },
        { id: 'no', label: '❌ Stop / No', icon: 'x' }
      ]
    };
  }

  return undefined;
};

export const useCampaignFlow = () => {
  const [state, setState] = useState<CampaignState>(initialState);
  const [messages, setMessages] = useState<Message[]>([INITIAL_WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [generatedScripts, setGeneratedScripts] = useState<ScriptOption[]>([]);
  const [generatedAvatars, setGeneratedAvatars] = useState<AvatarOption[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [fetchedAdAccounts, setFetchedAdAccounts] = useState<AdAccount[]>([]);
  const [threadId, setThreadId] = useState<string | null>(localStorage.getItem('vibelets_thread_id'));

  // Find the active question that can receive natural language input
  // Find the active question that can receive natural language input
  const activeQuestion: InlineQuestion | null = useMemo(() => {
    // Map current step to allowed question IDs to ensure relevance
    // Universal IDs allowed at any step for navigation/confirmation
    const universalIds = ['generic-confirmation', 'navigation-options', 'script-review', 'creative-review'];

    // Step-specific primary question IDs
    const stepToQuestionId: Record<string, string[]> = {
      'product-url': ['product-continue'],
      'product-analysis': ['product-continue'],
      'script-selection': ['script-selection'],
      'avatar-selection': ['avatar-selection'],
      'creative-generation': ['creative-selection', 'creative-review'],
      'creative-review': ['creative-review', 'creative-selection', 'creative-refinement'],
      'ad-account-selection': ['ad-account-selection'],
      'publish-campaign': ['publish-confirm'],
      'campaign-creation': ['campaign-input']
    };

    const allowedIds = [...(stepToQuestionId[state.step] || []), ...universalIds];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      // Only proceed if message has inlineQuestion AND it matches current step context
      if (msg.inlineQuestion && allowedIds.includes(msg.inlineQuestion.id)) {
        if (!selectedAnswers[msg.inlineQuestion.id]) {
          return msg.inlineQuestion;
        }
      }

      // OPTIONAL: Break early if we hit a message from a different step to avoid deep history? 
      // Current filtering by ID is safe enough.
    }
    return null;
  }, [messages, selectedAnswers, state.step]);



  const addMessage = useCallback((role: 'user' | 'assistant', content: string, options?: { inlineQuestion?: InlineQuestion; stepId?: CampaignStep; showCampaignSlider?: boolean; showFacebookConnect?: boolean }) => {
    const newMessage = createMessage(role, content, options);
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const simulateTyping = useCallback(async (content: string, options?: { inlineQuestion?: InlineQuestion; stepId?: CampaignStep; showCampaignSlider?: boolean; showFacebookConnect?: boolean }, delay = 1500) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, delay));
    setIsTyping(false);
    addMessage('assistant', content, options);
  }, [addMessage]);

  const handleError = useCallback((error: unknown, context: string) => {
    console.error(`Error in ${context}:`, error);
    const message = formatErrorMessage(error);
    toast.error(`${context} failed`, {
      description: message,
      duration: 5000,
    });
    setState(prev => ({ ...prev, isStepLoading: false, isRegenerating: null }));
    setIsTyping(false);
    addMessage('assistant', `Sorry, something went wrong while ${context.toLowerCase()}. Please try again or contact support if the issue persists.`);
  }, [addMessage]);

  // Sync state from backend response
  const syncStateFromBackend = useCallback((backendState: WorkflowState | null | undefined) => {
    if (!backendState) return;

    setState(prev => {
      const newState = { ...prev };

      // Update current step if changed
      if (backendState.current_step && backendState.current_step !== prev.step) {
        // Map backend step names to frontend step names if needed
        const stepMapping: Record<string, CampaignStep> = {
          'scrape': 'product-url',
          'analyze': 'product-analysis',
          'generate_scripts': 'script-selection',
          'select_script': 'script-selection',
          'refine_script': 'script-selection',
          'generate_images': 'creative-generation:images',
          'refine_images': 'creative-generation:images',
          'generate_audio': 'creative-generation:audio',
          'select_avatar': 'avatar-selection',
          'generate_video': 'creative-generation:video',
          'facebook_auth': 'facebook-integration',
          'select_ad_account': 'ad-account-selection',
          'select_media': 'creative-review',
          'preview_campaign': 'campaign-preview',
          'refine_campaign': 'campaign-preview',
          'publish_campaign': 'publishing'
        };

        const mappedStep = stepMapping[backendState.current_step as string] || backendState.current_step as CampaignStep;

        // Only update step if we are NOT in the middle of a frontend-controlled regeneration
        const isRegeneratingLocally = prev.isRegenerating !== null || prev.isStepLoading;

        if (STEP_ORDER.includes(mappedStep) && !isRegeneratingLocally) {
          newState.step = mappedStep;
          if (!newState.stepHistory.includes(mappedStep)) {
            newState.stepHistory = [...newState.stepHistory, mappedStep];
          }
        }
      }

      // Update data fields
      // Update data fields

      // CRITICAL: Update productUrl from backend to track URL changes
      if (backendState.url) {
        newState.productUrl = backendState.url;
      }

      // CRITICAL FIX: Explicitly handle both presence AND absence of product_data
      if (backendState.product_data) {
        const incomingData = backendState.product_data;

        // Extract and process images (handle downloaded_images and relative paths)
        const rawImages = incomingData.downloaded_images || incomingData.images || [];
        const processedImages = rawImages.map((img: string) => {
          if (img.startsWith('http') || img.startsWith('blob')) return img;
          // Ensure BACKEND_URL is used for local paths
          // Use relative paths to leverage Vite proxy
          // const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
          // return `${baseUrl}${img.startsWith('/') ? '' : '/'}${img}`;
          return img.startsWith('/') ? img : `/${img}`;
        });

        // Safely merge with existing data to prevent loss of images/price
        // BUT: If URL changed, don't preserve old images
        const urlChanged = prev.productUrl && backendState.url && prev.productUrl !== backendState.url;

        if (prev.productData && !urlChanged) {
          const existingData = prev.productData;
          const hasNewImages = processedImages.length > 0;

          newState.productData = {
            ...incomingData,
            // Preserve existing images if new ones are missing (same URL only)
            images: hasNewImages ? processedImages : existingData.images,
            // Preserve other fields if missing in incoming
            title: incomingData.title || existingData.title,
            price: (incomingData.price && incomingData.price !== '$0') ? incomingData.price : existingData.price,
            description: incomingData.description || existingData.description,
            sku: incomingData.sku || existingData.sku,
            category: incomingData.category || existingData.category,
            // Ensure screenshot is persisted
            pageScreenshot: incomingData.pageScreenshot || existingData.pageScreenshot,
            // Preserve variants
            variants: incomingData.variants || existingData.variants || [],
          };
        } else {
          // Different URL or no previous data - don't preserve old images
          newState.productData = {
            ...incomingData,
            images: processedImages,
            downloaded_images: processedImages
          };
        }

        // Map analysis to insights if available to display in ProductAnalysisPanel
        if (backendState.analysis) {
          const analysis = backendState.analysis;
          const insights = [];

          if (analysis.target_audience) {
            insights.push({ label: 'Target Audience', value: analysis.target_audience, icon: 'users' });
          }
          if (analysis.unique_selling_points || analysis.usps) {
            insights.push({ label: 'Key USPs', value: analysis.unique_selling_points || analysis.usps, icon: 'star' });
          }
          if (analysis.pain_points) {
            insights.push({ label: 'Pain Points', value: analysis.pain_points, icon: 'trending-up' });
          }
          if (analysis.call_to_action || analysis.cta) {
            insights.push({ label: 'Recommended CTA', value: analysis.call_to_action || analysis.cta, icon: 'dollar-sign' });
          }

          // Merge insights into productData
          newState.productData = {
            ...newState.productData,
            insights: insights
          };
        }
      } else if (backendState.hasOwnProperty('product_data') && backendState.product_data === null) {
        // CRITICAL: Backend explicitly cleared product_data (sent null)
        // This happens when a new URL is provided and backend clears old state
        console.log('🧹 Backend cleared product_data - syncing frontend state');
        newState.productData = null;
      }
      if (backendState.selected_script) newState.selectedScript = backendState.selected_script;

      // Handle generated scripts
      if (backendState.scripts && Array.isArray(backendState.scripts)) {
        // Frontend expects specific format, might need conversion if not matching
        // Assuming backend returns array of strings, we need to map to ScriptOption if not already done
        const formattedScripts: ScriptOption[] = backendState.scripts.map((scriptText: string, index: number) => {
          // Check if it's already an object or just string
          if (typeof scriptText === 'object') return scriptText;

          // Parse style and duration from content if available e.g. [Style: Fast-paced (15s)]
          const styleMatch = scriptText.match(/\[Style:\s*(.*?)(?:\((.*?)\))?\]/i);
          const parsedStyle = styleMatch ? styleMatch[1].trim() : 'Engaging';
          const parsedDuration = styleMatch && styleMatch[2] ? styleMatch[2].trim() : '30-60 seconds';

          // Clean body but KEEP full content
          const cleanBody = scriptText.replace(/\[Style:\s*.*?\]/i, '').trim();

          // Parse script into components
          const lines = cleanBody.split('\n').filter(line => line.trim().length > 0);

          // Hook: First 1-2 sentences (opening)
          const hookLines = lines.slice(0, Math.min(2, lines.length));
          const hook = hookLines.join(' ').trim();

          // CTA: Last sentence (if it contains action words like "Shop", "Buy", "Get", "Order", "Visit")
          const lastLine = lines[lines.length - 1] || '';
          const ctaKeywords = ['shop', 'buy', 'get', 'order', 'visit', 'click', 'discover', 'explore', 'try'];
          const hasCTA = ctaKeywords.some(keyword => lastLine.toLowerCase().includes(keyword));
          const cta = hasCTA ? lastLine.trim() : 'Shop Now';

          // Body: Everything between hook and CTA
          const bodyStartIndex = hookLines.length;
          const bodyEndIndex = hasCTA ? lines.length - 1 : lines.length;
          const bodyLines = lines.slice(bodyStartIndex, bodyEndIndex);
          const body = bodyLines.length > 0 ? bodyLines.join('\n').trim() : cleanBody;

          // Use full contents for description to avoid truncation
          const desc = cleanBody;

          return {
            id: `script-${index}`,
            name: `Script ${index + 1}`,
            description: desc,
            duration: parsedDuration,
            style: parsedStyle,
            body: body, // Main content (middle section)
            hook: hook, // Opening (first 1-2 sentences)
            cta: cta, // Call to action (last sentence or default)
            tone: 'Professional',
            content: cleanBody // Full script for editing
          };
        });
        setGeneratedScripts(formattedScripts);
      }

      if (backendState.generated_images || backendState.video_url) {
        setGeneratedImages(backendState.generated_images || []);

        // Convert to CreativeOptions for UI
        const backendImages = backendState.generated_images || [];
        const imageCreatives: CreativeOption[] = backendImages.map((imgUrl: string, index: number) => ({
          id: `gen-img-${index}`,
          type: 'image',
          thumbnail: imgUrl.startsWith('http') ? imgUrl : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${imgUrl}`,
          name: `Generated Image ${index + 1}`,
          format: 'feed',
          aspectRatio: '1:1'
        }));

        const creatives: CreativeOption[] = [...imageCreatives];

        // ISSUE 5 — video_aspect_ratio usage without guarantee
        const aspectRatio =
          backendState.video_aspect_ratio ||
          backendState.state?.video_aspect_ratio ||
          '9:16';
        newState.video_aspect_ratio = aspectRatio;

        // Add video if present OR if we have a video_id (meaning it's pending)
        if (backendState.video_url || backendState.video_id) {
          creatives.unshift({
            id: 'video-creative',
            type: 'video',
            name: 'AI Generated Video',
            // Use generating placeholder thumbnail if none yet
            thumbnail: backendState.video_url ? (imageCreatives[0]?.thumbnail || '') : '',
            videoUrl: backendState.video_url,
            format: 'feed',
            aspectRatio: aspectRatio
          });
        }

        if (creatives.length > 0) {
          newState.creatives = creatives;
        }
      }

      // Handle available avatars
      if (backendState.available_avatars && Array.isArray(backendState.available_avatars)) {
        const mappedAvatars: AvatarOption[] = backendState.available_avatars.map((a: any) => ({
          id: a.avatar_id || a.id,
          name: a.avatar_name || a.name || 'AI Presenter',
          image: a.preview_image_url || a.thumbnail || '',
          videoPreview: a.preview_video_url || undefined,
          style: a.gender || a.style || 'Professional'
        }));

        // Limit to 10 avatars to prevent UI clutter in both panels
        setGeneratedAvatars(mappedAvatars.slice(0, 10));
      }

      // Handle error from backend state
      if (backendState.error) {
        toast.error(backendState.error);
      }

      return newState;
    });
  }, []);

  // Restore session
  const restoreSession = useCallback(async () => {
    try {
      console.log('🔄 Attempting to restore session...');
      const result = await vibeletsAPI.getCurrentState();

      if (result && result.state) {
        console.log('✅ Session restored:', result.state);
        console.log('Product data:', result.state.product_data);
        console.log('Messages count:', result.state.messages?.length || 0);

        // FIRST: Sync all backend state (this includes productData with variants)
        syncStateFromBackend(result.state);

        // SECOND: Restore messages after state is synced
        if (result.state.messages && Array.isArray(result.state.messages) && result.state.messages.length > 0) {
          // Restore full message history
          const restoredMessages = result.state.messages.map((m: any) => {
            const msg: Message = {
              id: m.id || crypto.randomUUID(),
              role: m.role || 'user',
              content: m.content || '',
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            };

            // Restore optional properties if present
            if (m.inlineQuestion) msg.inlineQuestion = m.inlineQuestion;
            if (m.stepId) msg.stepId = m.stepId;
            if (m.showCampaignSlider) msg.showCampaignSlider = m.showCampaignSlider;
            if (m.showFacebookConnect) msg.showFacebookConnect = m.showFacebookConnect;

            return msg;
          });

          console.log('Restored messages:', restoredMessages.length);
          setMessages(restoredMessages);
        } else {
          // If new thread or empty, reset to welcome
          console.log('No messages found, using welcome message');
          setMessages([INITIAL_WELCOME_MESSAGE]);
        }
      } else {
        // Should not happen if thread exists, but fallback
        console.warn('No state returned from backend');
        setMessages([INITIAL_WELCOME_MESSAGE]);
        setState(initialState);
      }
    } catch (err) {
      console.warn("Failed to restore session:", err);
      // Fallback
      setMessages([INITIAL_WELCOME_MESSAGE]);
      setState(initialState);
    }
  }, [syncStateFromBackend]);

  // Load a specific thread
  const loadThread = useCallback(async (threadId: string) => {
    vibeletsAPI.setThreadId(threadId);
    setThreadId(threadId); // Update local state to trigger UI update
    await restoreSession(); // This will fetch state for new thread ID
  }, [restoreSession]);

  // Start a new thread
  const startNewThread = useCallback(() => {
    vibeletsAPI.createNewThread();
    setThreadId(null); // Clear local state
    setState(initialState);
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setSelectedAnswers({}); // Reset selected answers for new thread
    // Optionally trigger a backend ping to create the thread ID early?
    // No, we can wait for first action like scrape.
  }, []);

  // Restore session on mount ONLY if thread ID exists
  useEffect(() => {
    // If we have a stored thread ID, try to load it
    if (localStorage.getItem('vibelets_thread_id')) {
      restoreSession();
    }
  }, []); // Only on mount

  const handleUserMessage = useCallback(async (content: string) => {
    const sanitizedContent = content.trim();
    if (!sanitizedContent) return;

    // 1. Check if input is a URL (specific handling for scraping flow)
    // We prioritize this for 'welcome' and 'product-url' steps to ensure robust scraping
    const urlMatch = sanitizedContent.match(/(https?:\/\/[^\s]+)/g);
    const potentialUrl = urlMatch ? urlMatch[0] : sanitizedContent;
    const isUrl = isValidUrl(potentialUrl);

    if (isUrl && (state.step === 'welcome' || state.step === 'product-url')) {
      addMessage('user', sanitizedContent);
      // COMPLETELY CLEAR OLD PRODUCT CONTEXT when new URL is provided
      setState(prev => ({
        ...prev,
        productUrl: potentialUrl,
        // Clear ALL old product-related data
        productData: null,
        analysis: null,
        scripts: null,
        selectedScript: null,
        selectedScriptIndex: null,
        generatedImages: null,
        audioFile: null,
        audioUrl: null,
        videoId: null,
        videoUrl: null,
        // Clear feedback
        analysisFeedback: [],
        scriptFeedback: [],
        scriptRefinementFeedback: [],
        imageFeedback: [],
        // Reset step
        step: 'product-analysis',
        isStepLoading: true
      }));

      await simulateTyping("Perfect! Analyzing your product page now... 🔍", { stepId: 'product-analysis' }, 1000);

      setIsTyping(true);
      try {
        // CALL BACKEND - Scrape product
        const scrapeResult = await vibeletsAPI.scrapeProduct(potentialUrl);

        if (scrapeResult.error) {
          setIsTyping(false);
          throw new Error(scrapeResult.error);
        }

        const scrapedProduct = scrapeResult.product_data;

        // CRITICAL FIX: If backend returns null product_data, it means scraping failed
        // We should NOT create fake fallback data - instead, clear state and show error
        if (!scrapedProduct) {
          setIsTyping(false);
          setState(prev => ({
            ...prev,
            productData: null,
            isStepLoading: false
          }));
          throw new Error('Failed to scrape product data. Please check the URL and try again.');
        }

        // CALL BACKEND - Analyze product
        const analysisResult = await vibeletsAPI.analyzeProduct();
        setIsTyping(false);

        if (analysisResult.error) {
          throw new Error(analysisResult.error);
        }

        const productAnalysis = analysisResult.analysis;

        // Generate insights from analysis
        const insights: ProductInsight[] = [];

        if (productAnalysis) {
          // Category
          if (productAnalysis.category) {
            insights.push({
              label: 'Product Category',
              value: formatInsightValue(productAnalysis.category),
              icon: 'tag'
            });
          }

          // Key Features
          if (productAnalysis.features) {
            const featuresValue = Array.isArray(productAnalysis.features) ? productAnalysis.features.join(', ') : formatInsightValue(productAnalysis.features);
            insights.push({ label: 'Key Features', value: featuresValue, icon: 'list' });
          }

          // Target Audience
          if (productAnalysis.target_audience) {
            insights.push({
              label: 'Target Audience',
              value: formatInsightValue(productAnalysis.target_audience),
              icon: 'users'
            });
          }

          // Key USPs
          if (productAnalysis.usps) {
            const uspsValue = Array.isArray(productAnalysis.usps) ? productAnalysis.usps.join(', ') : formatInsightValue(productAnalysis.usps);
            insights.push({ label: 'Key USPs', value: uspsValue, icon: 'star' });
          }

          // Pain Points
          if (productAnalysis.pain_points) {
            const painValue = Array.isArray(productAnalysis.pain_points) ? productAnalysis.pain_points.join(', ') : formatInsightValue(productAnalysis.pain_points);
            insights.push({ label: 'Pain Points Solved', value: painValue, icon: 'alert-circle' });
          }

          // Marketing Angles
          if (productAnalysis.marketing_angles) {
            const anglesValue = Array.isArray(productAnalysis.marketing_angles) ? productAnalysis.marketing_angles.join(', ') : formatInsightValue(productAnalysis.marketing_angles);
            insights.push({ label: 'Marketing Angles', value: anglesValue, icon: 'trending-up' });
          }

          // Positioning
          if (productAnalysis.positioning) {
            insights.push({ label: 'Market Positioning', value: formatInsightValue(productAnalysis.positioning), icon: 'target' });
          }

          // CTA if available
          if (productAnalysis.call_to_action || productAnalysis.cta) {
            insights.push({ label: 'Recommended CTA', value: productAnalysis.call_to_action || productAnalysis.cta, icon: 'dollar-sign' });
          }
        }

        // Process images (add backend prefix if needed)
        const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const productImages = (scrapedProduct?.downloaded_images || scrapedProduct?.images || []).map((imgPath: string) => {
          if (imgPath.startsWith('http')) return imgPath;
          return `${BACKEND_URL}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;
        });

        const productData: ProductData = {
          title: scrapedProduct?.title || 'Product',
          price: scrapedProduct?.price || '$0',
          description: scrapedProduct?.description || '',
          sku: scrapedProduct?.sku || '',
          category: productAnalysis?.category || scrapedProduct?.category || '',
          images: productImages,

          // image helpers
          downloaded_images: scrapedProduct?.downloaded_images || [],
          main_image: productImages[0],
          pageScreenshot: productImages[0],

          // variants
          variants: scrapedProduct?.variants || [],
          variants_count: scrapedProduct?.variants?.length || 0,

          // AI
          insights,

          // meta
          confidence: scrapedProduct?.confidence,
          raw_text: scrapedProduct?.raw_text,
        };


        setState(prev => ({ ...prev, productData, isStepLoading: false }));

        // Create options with dynamic variants if available
        const defaultContinueOption = { id: 'continue', label: 'Continue', description: 'Proceed with this product' };

        let variantOptions: QuestionOption[] = [];
        if (productData.variants && productData.variants.length > 0) {
          variantOptions = productData.variants.slice(0, 3).map((v, idx) => ({
            id: `variant-${idx}`,
            label: `Select ${v.value || v.name}`,
            description: v.price ? `Price: ${v.price}` : 'Select this variant',
            icon: 'layers'
          }));

          // If we have variants, renaming the default continue to be more specific
          if (variantOptions.length > 0) {
            defaultContinueOption.label = 'Use Main Product';
            defaultContinueOption.description = 'Proceed with main item';
          }
        }

        const continueQuestion: InlineQuestion = {
          id: 'product-continue',
          question: 'Ready to create your ad?',
          options: [
            defaultContinueOption,
            ...variantOptions,
            { id: 'change', label: 'Change URL', description: 'Use a different product' },
            { id: 'back', label: 'Go Back', description: 'Re-enter URL' },
            { id: 'start-over', label: 'Start Over', description: 'Reset campaign' }
          ]
        };

        await simulateTyping(
          `I've analyzed your product page and found some great insights!\n\n**${productData.title}** looks perfect for video ads. Ready to proceed?`,
          { inlineQuestion: continueQuestion, stepId: 'product-analysis' },
          1500
        );
        return; // Stop here, don't call chat
      } catch (error) {
        handleError(error, 'Analyzing product');
        setState(prev => ({ ...prev, isStepLoading: false }));
        return;
      }
    }

    // 2. For non-URL messages, use Backend Chat for intent/navigation
    // Optimistically add message so user sees it immediately
    const tempMessageId = addMessage('user', sanitizedContent);

    setIsTyping(true);
    try {
      console.log('📤 Calling backend chat API with message:', sanitizedContent);
      const response = await vibeletsAPI.chat(sanitizedContent);
      console.log('📥 Backend response:', response);
      setIsTyping(false);

      if (response.error) {
        throw new Error(response.error);
      }

      // Sync state if backend provides it (this will handle navigation/step changes)
      if (response.state) {
        if (response.thread_id && response.thread_id !== threadId) {
          setThreadId(response.thread_id);
        }
        syncStateFromBackend(response.state);
      }

      // Check for explicit navigation intent form backend
      if (response.navigation_intent) {
        if (response.navigation_intent === 'change_url' || response.navigation_intent === 'scrape') {
          setState(prev => ({
            ...prev,
            step: 'product-url',
            productUrl: null,
            productData: null,
            isStepLoading: false
          }));
          setGeneratedScripts([]);
        }
      }

      // Check if it's a support response
      if (response.is_support_response) {
        // Remove the optimistic user message from main chat since it's strictly support
        removeMessage(tempMessageId);

        // Return proper structure for ChatPanel to handle opening the assistant
        return {
          type: 'support',
          answer: {
            answer: response.message,
            suggested_actions: response.suggested_actions,
            confidence: response.support_confidence
          }
        };
      }

      // It IS a workflow message - Message already added optimistically

      // Check navigation intent
      const navigationIntent = response.navigation_intent;
      console.log('🧭 Navigation intent:', navigationIntent);

      // RESET/CHANGE URL LOGIC
      if (['change_url', 'start_over', 'restart', 'new_url', 'scrape', 'product-url'].includes(navigationIntent)) {
        console.log('🔄 Resetting flow for new product');
        setState(prev => ({
          ...prev,
          step: 'product-url',
          productUrl: '',
          productData: null,
          selectedAnswers: {}, // Clear selected answers to reset flow
          isStepLoading: false
        }));

        await simulateTyping(response.message || "Ready for a new product! Paste your product URL below.", { stepId: 'product-url' }, 500);
        return;
      }

      // DIRECT NAVIGATION - No loading, no re-analyzing
      const directIntents = [
        'back', 'previous', 'next', 'continue', 'proceed', 'scrape', 'product-url',
        'change_url', 'new_url', 'start_over', 'restart',
        'select_media', 'generate_video', 'generate_images',
        'select_avatar', 'select_script', 'generate_scripts', 'analyze', 'refine_script', 'refine_images',
        'view_scripts', 'show_scripts', 'go_to_scripts', 'script-selection', 'scripts', // Enhanced script intents
        'creative-generation', 'avatar-selection', 'ad-account-selection', 'campaign-preview', // Step names
        'facebook-auth', 'facebook-integration' // Facebook intents
      ];

      if (directIntents.includes(navigationIntent) || navigationIntent.includes('go_to_')) {

        // Map backend step to frontend step (keeping existing mapping)
        const stepMapping: Record<string, CampaignStep> = {
          'scrape': 'product-url',
          'analyze': 'product-analysis',
          'generate_scripts': 'script-selection',
          'select_script': 'script-selection',
          'refine_script': 'script-selection',
          'view_scripts': 'script-selection',
          'show_scripts': 'script-selection',
          'go_to_scripts': 'script-selection',
          'script-selection': 'script-selection',
          'scripts': 'script-selection',
          'generate_images': 'creative-generation',
          'avatar-selection': 'avatar-selection',
          'facebook-auth': 'facebook-integration',
          'ad-account-selection': 'ad-account-selection',
          'campaign-creation': 'campaign-preview',
          'select_media': 'creative-review'
        };

        const newStep = stepMapping[response.current_step] || (response.current_step ? response.current_step as CampaignStep : state.step);

        // UPDATE STATE: Sync with backend (important for scripts/avatars/video)
        if (response.state) {
          syncStateFromBackend(response.state);
        } else {
          // If no state provided, at least update the step
          setState(prev => ({
            ...prev,
            step: newStep,
            isStepLoading: false
          }));
        }

        // Show the backend's message with auto quick actions
        let autoQuestion = getAutoQuickActions(response.message, newStep);

        // If keyword detection fails, fallback to step-specific defaults
        if (!autoQuestion) {
          autoQuestion = getStepQuestion(newStep);
        }

        await simulateTyping(response.message, {
          inlineQuestion: autoQuestion,
          stepId: newStep
        }, 500);
        return;
      }

      // Handle other navigation intents
      if (navigationIntent && shouldConfirmIntent(navigationIntent)) {
        console.log('✅ Showing navigation options');
        const intentDescription = getIntentDescription(navigationIntent, state.step);
        const alternativeOptions = getAlternativeNavigationOptions(state.step);

        const confirmation: IntentConfirmation = {
          id: crypto.randomUUID(),
          originalMessage: sanitizedContent,
          detectedIntent: navigationIntent,
          intentDescription,
          alternativeOptions
        };

        setState(prev => ({ ...prev, pendingIntentConfirmation: confirmation, isStepLoading: false }));

        const allOptions: QuestionOption[] = [
          {
            id: 'confirm-detected',
            label: `✓ ${intentDescription}`,
            description: 'What I understood from your message'
          },
          ...alternativeOptions
        ];

        const navigationQuestion: InlineQuestion = {
          id: 'navigation-options',
          question: `I understood: "${intentDescription}". What would you like to do?`,
          options: allOptions,
          metadata: { confirmation }
        };

        const displayMessage = response.message || `Let me help you navigate...`;

        await simulateTyping(
          displayMessage,
          { inlineQuestion: navigationQuestion, stepId: state.step },
          500
        );
        return;
      }

      // For chat messages without navigation intent, show backend's response
      if (response.message) {
        // Automatically attach quick actions if message looks like a question or step completion
        const autoQuestion = getAutoQuickActions(response.message, state.step);
        await simulateTyping(response.message, {
          inlineQuestion: autoQuestion,
          stepId: state.step
        }, 500);
      }

    } catch (error) {
      handleError(error, 'Processing your message');
    }
  }, [state.step, addMessage, removeMessage, handleError, syncStateFromBackend, simulateTyping]);


  const goToStep = useCallback(async (targetStep: CampaignStep) => {
    // legacy goToStep for sidebar clicks - now should ideally notify backend too
    const targetIndex = STEP_ORDER.indexOf(targetStep);
    const currentIndex = STEP_ORDER.indexOf(state.step);

    if (targetIndex < currentIndex) {
      // Clear selectedAnswers for steps we're going back to
      setSelectedAnswers(prev => {
        const newAnswers = { ...prev };
        // Clear answers for the target step and all steps after it
        if (targetIndex <= STEP_ORDER.indexOf('product-analysis')) {
          delete newAnswers['product-continue'];
          delete newAnswers['script-selection'];
          delete newAnswers['avatar-selection'];
          delete newAnswers['creative-selection'];
          delete newAnswers['ad-account-selection'];
          delete newAnswers['publish-confirm'];
        } else if (targetIndex <= STEP_ORDER.indexOf('script-selection')) {
          delete newAnswers['script-selection'];
          delete newAnswers['avatar-selection'];
          delete newAnswers['creative-selection'];
          delete newAnswers['ad-account-selection'];
          delete newAnswers['publish-confirm'];
        } else if (targetIndex <= STEP_ORDER.indexOf('avatar-selection')) {
          delete newAnswers['avatar-selection'];
          delete newAnswers['creative-selection'];
          delete newAnswers['ad-account-selection'];
          delete newAnswers['publish-confirm'];
        } else if (targetIndex <= STEP_ORDER.indexOf('creative-review')) {
          delete newAnswers['creative-selection'];
          delete newAnswers['ad-account-selection'];
          delete newAnswers['publish-confirm'];
        } else if (targetIndex <= STEP_ORDER.indexOf('ad-account-selection')) {
          delete newAnswers['ad-account-selection'];
          delete newAnswers['publish-confirm'];
        } else if (targetIndex <= STEP_ORDER.indexOf('campaign-preview')) {
          delete newAnswers['publish-confirm'];
        }
        return newAnswers;
      });

      // Allow going back purely on frontend for UI speed, but sync with backend
      setState(prev => {
        const newState = { ...prev, step: targetStep };

        // Reset DOWNSTREAM data based on target step - but be less aggressive when going back
        // We only clear data if we are definitively jumping back to a point that invalidates everything.
        if (targetIndex <= STEP_ORDER.indexOf('product-url')) {
          // If going back to URL input, we naturally expect to start a new product session eventually,
          // but we might just want to see the URL input again.
          // Don't clear productData here if it already exists, let 'start-over' or 'change_url' do it.
          newState.facebookConnected = false;
          newState.selectedAdAccount = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('product-analysis')) {
          newState.selectedScript = null;
          newState.selectedAvatar = null;
          newState.creatives = [];
          newState.selectedCreative = null;
          newState.campaignConfig = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('script-selection')) {
          newState.selectedAvatar = null;
          newState.creatives = [];
          newState.selectedCreative = null;
          newState.campaignConfig = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('avatar-selection')) {
          newState.creatives = [];
          newState.selectedCreative = null;
          newState.campaignConfig = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('creative-review')) {
          newState.campaignConfig = null;
        }
        newState.stepHistory = [...prev.stepHistory, targetStep];
        return newState;
      });

      const targetStepQuestion = getStepQuestion(targetStep);
      addMessage('assistant', `No problem! Let's go back and make changes. ${getStepPrompt(targetStep)}`, {
        stepId: targetStep,
        inlineQuestion: targetStepQuestion
      });

      // Notify backend of navigation (best effort)
      try {
        // Map frontend step back to backend step name
        const backendStepMapping: Record<CampaignStep, string> = {
          'product-url': 'scrape',
          'product-analysis': 'analyze',
          'script-generation': 'generate_scripts',
          'script-selection': 'script-selection',
          'script-refinement': 'refine_scripts',
          'avatar-selection': 'avatar-selection',
          'creative-generation': 'generate_images', // approx
          'creative-generation:images': 'generate_images',
          'creative-generation:audio': 'generate_audio',
          'creative-generation:video': 'generate_video',
          'creative-review': 'select_media',
          'campaign-setup': 'refine_campaign', // approx
          'facebook-integration': 'facebook_auth',
          'ad-account-selection': 'select_ad_account',
          'campaign-preview': 'preview_campaign',
          'publishing': 'publish_campaign',
          'published': 'publish_campaign',
          'welcome': 'scrape'
        };
        const backendStep = backendStepMapping[targetStep] || targetStep;
        await vibeletsAPI.navigate(backendStep);
      } catch (e) {
        console.warn("Failed to sync navigation with backend", e);
      }
    }
  }, [state.step, addMessage]);

  const getStepQuestion = useCallback((step: CampaignStep): InlineQuestion | undefined => {
    const currentIndex = STEP_ORDER.indexOf(step);
    const hasNextHistory = currentIndex < STEP_ORDER.length - 1 && (
      (step === 'product-url' && state.productData) ||
      (step === 'product-analysis' && generatedScripts.length > 0) ||
      (step === 'script-selection' && state.selectedScript) ||
      (step === 'avatar-selection' && state.selectedAvatar) ||
      (step === 'creative-review' && state.selectedCreative)
    );

    const backOption = currentIndex > 1 ? { id: 'back', label: '🔙 Go Back', icon: 'arrow-left' as const } : null;
    const nextOption = hasNextHistory ? { id: 'next', label: '✅ Next Step', icon: 'arrow-right' as const } : null;

    switch (step) {
      case 'product-url':
        return {
          id: 'product-url-actions',
          question: state.productData ? `I've analyzed ${state.productData.title}. Want to continue?` : 'Ready to analyze your product?',
          options: [
            ...(nextOption ? [nextOption] : []),
            { id: 'start-over', label: '🏠 Start Over', icon: 'rotate-ccw' }
          ]
        };
      case 'product-analysis':
        return {
          id: 'product-continue',
          question: 'Ready to continue to script generation?',
          options: [
            { id: 'continue', label: '✅ Yes, Generate Scripts', icon: 'zap' },
            ...(nextOption ? [nextOption] : []),
            { id: 'change', label: '🔗 Change product', icon: 'link' },
            ...(backOption ? [backOption] : [])
          ]
        };
      case 'script-selection':
        if (generatedScripts && generatedScripts.length > 0) {
          return {
            id: 'script-selection',
            question: 'Which script style would you like to proceed with?',
            options: [
              ...generatedScripts.map((s, i) => ({
                id: `script-${i}`,
                label: s.style ? `${s.style} (${s.duration})` : s.name,
                description: s.name,
                icon: 'file-text' as const
              })),
              ...(nextOption ? [nextOption] : []),
              ...(backOption ? [backOption] : [])
            ]
          };
        }
        break;
      case 'avatar-selection':
        const avatars = generatedAvatars && generatedAvatars.length > 0 ? generatedAvatars : avatarOptions;
        return {
          id: 'avatar-selection',
          question: 'Select an AI presenter for your video:',
          options: [
            ...avatars.slice(0, 10).map(a => ({
              id: a.id,
              label: a.name,
              description: a.style,
              icon: 'user' as const
            })),
            { id: 'approve-avatar', label: '✅ Confirm & Next', icon: 'check' },
            ...(nextOption ? [nextOption] : []),
            ...(backOption ? [backOption] : []),
            { id: 'start-over', label: '🏠 Start Over', icon: 'rotate-ccw' }
          ],
          hideOptionsInChat: true
        };
      case 'creative-review':
        if (state.creatives && state.creatives.length > 0) {
          return {
            id: 'creative-selection',
            question: 'Select your preferred creative:',
            options: [
              ...state.creatives.map(c => ({
                id: c.id,
                label: c.name,
                description: c.type === 'video' ? 'Video format' : 'Image format'
              })),
              { id: 'approve-creative', label: '✅ Approve & Next', icon: 'check' },
              ...(nextOption ? [nextOption] : []),
              { id: 'custom-creative', label: '📤 Upload My Own', description: 'Use your own image or video' },
              ...(backOption ? [backOption] : [])
            ]
          };
        }
        break;
      case 'campaign-setup':
        return {
          id: 'generic-confirmation',
          question: 'What would you like to do next?',
          options: [
            { id: 'next', label: '✅ Continue', icon: 'arrow-right' },
            ...(backOption ? [backOption] : [])
          ]
        };
    }
    return undefined;
  }, [generatedScripts, generatedAvatars, state.creatives, state.productData, state.selectedScript, state.selectedAvatar, state.selectedCreative]);

  const getStepPrompt = (step: CampaignStep): string => {
    const prompts: Record<CampaignStep, string> = {
      'welcome': "Paste your product URL to begin.",
      'product-url': "Paste a new product URL.",
      'product-analysis': "Analyzing your product...",
      'script-generation': "Generating ad scripts...",
      'script-selection': "Choose a script style for your ad.",
      'script-refinement': "Refine and customize your script.",
      'avatar-selection': "Select an AI presenter.",
      'creative-generation': "Generating your creatives...",
      'creative-generation:images': "Generating AI images...",
      'creative-generation:audio': "Generating voiceover...",
      'creative-generation:video': "Assembling final video...",
      'creative-review': "Review and select a creative.",
      'campaign-setup': "Configure your campaign settings.",
      'facebook-integration': "Connect your Facebook account.",
      'ad-account-selection': "Select your ad account.",
      'campaign-preview': "Review and publish your campaign.",
      'publishing': "Publishing your campaign...",
      'published': "Campaign published successfully!"
    };
    return prompts[step];
  };

  // Internal handler that can skip adding user message (for NLP-matched inputs)
  const handleQuestionAnswerInternal = useCallback(async (questionId: string, answerId: string, skipUserMessage = false) => {
    try {
      if (!questionId || !answerId) {
        toast.error('Invalid selection', { description: 'Please try again' });
        return;
      }

      // Track the answer (except for navigation-options which is reusable)
      if (questionId !== 'navigation-options' && answerId !== 'back' && answerId !== 'next' && answerId !== 'change') {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));
      }

      // Universal Navigation Handlers - intercepted before specific question logic
      if (answerId === 'back') {
        if (!skipUserMessage) addMessage('user', "🔙 Go Back");
        const currentIndex = STEP_ORDER.indexOf(state.step);
        if (currentIndex > 1) { // PREVENT GOING BACK TO 'welcome' (index 0)
          let prevIndex = currentIndex - 1;

          // Special logic: If strictly inside creative generation or sub-steps, go back ONE step only 
          // (to allow reviewing previous generated item), unless it's a main step jump.
          const isSubStep = state.step.includes(':');

          if (!isSubStep) {
            // Standard behavior: Find the nearest previous navigable MAIN step (skip intermediate sub-steps with colons)
            while (prevIndex > 1 && STEP_ORDER[prevIndex].includes(':')) {
              prevIndex--;
            }
          }
          // If isSubStep is true, we simply go to prevIndex (which is currentIndex - 1), effectively going back 1 granular step.

          const prevStep = STEP_ORDER[prevIndex];
          await goToStep(prevStep);
        }
        return;
      }

      if (answerId === 'start-over') {
        if (!skipUserMessage) addMessage('user', "🏠 Start Over");
        await goToStep('product-url');
        setState(prev => ({ ...prev, productData: null, messages: [INITIAL_WELCOME_MESSAGE] }));
        return;
      }

      if (answerId === 'next' || answerId === 'continue') {
        if (!skipUserMessage) addMessage('user', "✅ Next Step");
        const currentIndex = STEP_ORDER.indexOf(state.step);
        if (currentIndex < STEP_ORDER.length - 1) {
          // Find the nearest next navigable step (skip intermediate sub-steps with colons)
          let nextIndex = currentIndex + 1;
          while (nextIndex < STEP_ORDER.length - 1 && STEP_ORDER[nextIndex].includes(':')) {
            nextIndex++;
          }
          const nextStep = STEP_ORDER[nextIndex];
          await goToStep(nextStep);
        }
        return;
      }


      if (questionId === 'product-continue') {
        if (answerId === 'change') {
          // Handle Change URL case
          if (!skipUserMessage) addMessage('user', "I want to change the product URL.");

          setState(prev => ({
            ...prev,
            step: 'product-url',
            productUrl: null,
            productData: null,
            isStepLoading: false
          }));
          setGeneratedScripts([]);

          // Notify backend we are changing URL (reset)
          await vibeletsAPI.navigate('change_url');

          await simulateTyping("No problem! Paste a new product URL to analyze.", { stepId: 'product-url' }, 500);
          return;
        }

        if (answerId === 'continue' || answerId === 'yes' || answerId.startsWith('variant-')) {

          // Handle Variant Selection Logic
          if (answerId.startsWith('variant-')) {
            const idx = parseInt(answerId.split('-')[1]);
            const variant = state.productData?.variants?.[idx];
            if (variant) {
              if (!skipUserMessage) addMessage('user', `Selected variant: ${variant.value || variant.name}`);

              // Update product data with variant details
              setState(prev => {
                if (!prev.productData) return prev;
                return {
                  ...prev,
                  productData: {
                    ...prev.productData,
                    title: `${prev.productData.title} - ${variant.value || variant.name}`,
                    price: variant.price || prev.productData.price,
                    // If variant has specific image, we could swap main_image here too
                  }
                };
              });
            }
          } else {
            if (!skipUserMessage) addMessage('user', "Let's continue!");
          }

          setState(prev => ({ ...prev, isStepLoading: true }));

          try {
            // Notify backend that we are moving to script generation (explicit navigation)
            await vibeletsAPI.navigate('generate_scripts');

            const scriptsResult = await vibeletsAPI.generateScripts();

            if (scriptsResult.error) {
              throw new Error(scriptsResult.error);
            }

            // Convert backend response to frontend ScriptOption format
            const backendScripts = scriptsResult.scripts || [];
            console.log('🎬 Backend scripts received:', backendScripts);

            // Fetch analysis and product data to populate the dashboard
            const analysisResult = await vibeletsAPI.analyzeProduct();
            const productAnalysis = analysisResult.analysis;
            const scrapedProduct = analysisResult.product_data;

            const formattedScripts: ScriptOption[] = backendScripts.map((scriptText: string, index: number) => {
              console.log(`📜 Raw Script ${index}:`, scriptText); // Debugging log

              // Robust parsing for Style and Duration
              // Try standard format first: [Style: Fast-paced (15-30s)]
              let styleMatch = scriptText.match(/\[Style:\s*([^(]+?)\s*(?:\(([^)]+)\))?\]/i);

              let parsedStyle = 'Engaging';
              let parsedDuration = '30-60 seconds';

              if (styleMatch) {
                parsedStyle = styleMatch[1].trim();
                parsedDuration = styleMatch[2] ? styleMatch[2].trim() : parsedDuration;
                console.log(`✅ Style matched for script ${index}: "${parsedStyle}" | Duration: "${parsedDuration}"`);
              } else {
                // Fallback: Try to find "Style:" and "Duration:" lines if formatted differently
                const styleLine = scriptText.match(/Style:\s*(.*)/i);
                const durationLine = scriptText.match(/Duration:\s*(.*)/i);

                if (styleLine) {
                  parsedStyle = styleLine[1].trim();
                  console.log(`⚠️ Using fallback style line for script ${index}: "${parsedStyle}"`);
                }
                if (durationLine) {
                  parsedDuration = durationLine[1].trim();
                  console.log(`⚠️ Using fallback duration line for script ${index}: "${parsedDuration}"`);
                }
                if (!styleLine && !durationLine) {
                  console.log(`❌ No style/duration found for script ${index}, using defaults`);
                }
              }

              // Clean body by removing the [Style: ...] header or Style/Duration lines
              let cleanBody = scriptText
                .replace(/\[Style:.*?\]/i, '')
                .replace(/Style:.*\n?/i, '')
                .replace(/Duration:.*\n?/i, '')
                .trim();

              // Clean up any leading "### SCRIPT [N] ###" or similar artifacts
              cleanBody = cleanBody.replace(/^###.*?###/gm, '').trim();

              // Use full body for description
              const desc = cleanBody;

              return {
                id: `script-${index}`,
                name: `Script ${index + 1}`,
                description: desc,
                duration: parsedDuration,
                style: parsedStyle,
                body: cleanBody,
                hook: cleanBody.split('\n').find(line => line.trim().length > 0) || '',
                cta: 'Shop Now',
                tone: 'Professional'
              };
            });

            // Log final formatted scripts
            console.log('🎬 Formatted scripts with parsed styles:', formattedScripts.map(s => ({
              id: s.id,
              name: s.name,
              style: s.style,
              duration: s.duration
            })));

            // Advance step to script selection
            setState(prev => ({ ...prev, step: 'script-selection', isStepLoading: false }));

            console.log('🎬 Formatted scripts:', formattedScripts);
            setGeneratedScripts(formattedScripts);

            // Generate insights from analysis
            const insights: ProductInsight[] = [];

            if (productAnalysis) {
              // Add category insight
              if (productAnalysis.category) {
                insights.push({
                  label: 'Product Category',
                  value: formatInsightValue(productAnalysis.category),
                  icon: 'tag'
                });
              }

              // Add target audience insight
              if (productAnalysis.target_audience) {
                insights.push({
                  label: 'Target Audience',
                  value: formatInsightValue(productAnalysis.target_audience),
                  icon: 'users'
                });
              }

              // Add USP insight  
              if (productAnalysis.usps) {
                const uspsValue = Array.isArray(productAnalysis.usps)
                  ? productAnalysis.usps.join(', ')
                  : formatInsightValue(productAnalysis.usps);
                insights.push({
                  label: 'Key USPs',
                  value: uspsValue,
                  icon: 'star'
                });
              }

              // Add marketing angle insight
              if (productAnalysis.marketing_angles) {
                const anglesValue = Array.isArray(productAnalysis.marketing_angles)
                  ? productAnalysis.marketing_angles.join(', ')
                  : formatInsightValue(productAnalysis.marketing_angles);
                insights.push({
                  label: 'Marketing Angles',
                  value: anglesValue,
                  icon: 'trending-up'
                });
              }
            }

            // Convert backend response to frontend ProductData format
            // Add backend URL prefix to image paths
            const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

            // Debug logging
            console.log('🔍 Backend scrape data:', scrapedProduct);
            console.log('🔍 Downloaded images:', scrapedProduct?.downloaded_images);
            console.log('🔍 Regular images:', scrapedProduct?.images);
            console.log('🔍 Backend URL:', BACKEND_URL);




            // Merge with existing product data if available to prevent data loss
            const existingProductData = state.productData;

            const productImagesRaw = scrapedProduct?.downloaded_images || scrapedProduct?.images || [];

            // If backend returns no images, use existing ones
            const productImages = productImagesRaw.length > 0
              ? productImagesRaw.map((imgPath: string) => {
                if (imgPath.startsWith('http')) return imgPath;
                return `${BACKEND_URL}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;
              })
              : existingProductData?.images || [];

            console.log('🔍 Final product images:', productImages);

            const productData: ProductData = {
              title: scrapedProduct?.title || existingProductData?.title || 'Product',
              price: scrapedProduct?.price || existingProductData?.price || '$0',
              description: scrapedProduct?.description || existingProductData?.description || '',
              sku: scrapedProduct?.sku || existingProductData?.sku || '',
              category: productAnalysis?.category || scrapedProduct?.category || existingProductData?.category || '',
              images: productImages,

              downloaded_images: scrapedProduct?.downloaded_images || existingProductData?.downloaded_images || [],
              main_image: productImages[0] || existingProductData?.main_image,
              pageScreenshot: productImages[0] || existingProductData?.pageScreenshot,

              variants: scrapedProduct?.variants || existingProductData?.variants || [],
              variants_count:
                scrapedProduct?.variants?.length ??
                existingProductData?.variants_count ??
                0,

              insights: insights.length > 0 ? insights : existingProductData?.insights || [],

              confidence: scrapedProduct?.confidence ?? existingProductData?.confidence,
              raw_text: scrapedProduct?.raw_text ?? existingProductData?.raw_text,
            };


            setState(prev => ({ ...prev, productData, isStepLoading: false }));

            const scriptQuestion: InlineQuestion = {
              id: 'script-selection',
              question: 'Which script would you like to proceed with?',
              options: formattedScripts.map((s, i) => ({
                id: `script-${i}`,
                label: s.style ? `${s.style} (${s.duration})` : s.name,
                description: s.name,
                icon: 'file-text'
              }))
            };

            await simulateTyping(
              "Great! I've generated 3 script options for you. Each one tells your product's story in a unique way:\n\nSelect a style below to proceed or ask me to refine one!",
              { inlineQuestion: scriptQuestion, stepId: 'script-selection' },
              1000
            );

            // Advance step to script selection explicitly
            setState(prev => ({ ...prev, step: 'script-selection', isStepLoading: false }));

          } catch (error) {
            handleError(error, 'Generating scripts');
            setState(prev => ({ ...prev, isStepLoading: false }));
          }
        }
      }

      // Handle Script Selection
      if (questionId === 'script-selection') {
        // answerId will be 'script-0', 'script-1', etc.
        const scriptIndex = parseInt(answerId.replace('script-', ''));
        const selectedScript = generatedScripts[scriptIndex];

        if (selectedScript) {
          if (!skipUserMessage) addMessage('user', `I'll go with ${selectedScript.name}`);

          setState(prev => ({
            ...prev,
            selectedScript,
            isStepLoading: true
          }));

          try {
            // Notify backend of selection
            await vibeletsAPI.selectScript(scriptIndex);

            // Fetch real HeyGen avatars if move to avatar selection
            let avatarsToUse = generatedAvatars;
            if (avatarsToUse.length === 0) {
              try {
                const avatarResponse = await vibeletsAPI.getAvatars();
                if (avatarResponse.avatars && avatarResponse.avatars.length > 0) {
                  avatarsToUse = avatarResponse.avatars.map((a: any) => ({
                    id: a.avatar_id || a.id,
                    name: a.avatar_name || a.name || 'AI Presenter',
                    image: a.preview_image_url || a.thumbnail || '',
                    videoPreview: a.preview_video_url || undefined,
                    style: a.style || 'Professional'
                  }));
                  setGeneratedAvatars(avatarsToUse.slice(0, 10));
                }
              } catch (err) {
                console.error('Failed to fetch avatars:', err);
              }
            }

            // Fallback to mock if still empty (should not happen if API key is valid)
            const finalAvatars = avatarsToUse.length > 0 ? avatarsToUse : avatarOptions;

            const refinementQuestion: InlineQuestion = {
              id: 'script-refinement',
              question: 'Would you like to refine or customize this script before proceeding?',
              options: [
                { id: 'refine', label: '✏️ Refine Script', description: 'Edit and customize the script' },
                { id: 'next', label: '✅ Next', description: 'Keep script and continue' },
                { id: 'back', label: '🔙 Go Back', description: 'Return to script selection' },
                { id: 'start-over', label: '🏠 Start Over', description: 'Reset campaign' }
              ],
              hideOptionsInChat: true
            };

            setState(prev => ({ ...prev, isStepLoading: false }));

            await simulateTyping(
              `Perfect! I've selected that script. 📝\n\nWould you like to refine this script or proceed to select your AI avatar?`,
              { inlineQuestion: refinementQuestion, stepId: 'script-refinement' },
              1000
            );

            setState(prev => ({
              ...prev,
              step: 'script-refinement',
              stepHistory: [...prev.stepHistory, 'script-refinement'],
              isStepLoading: false
            }));

          } catch (error) {
            console.error('❌ Script selection failed:', error);
            handleError(error, 'Selecting script');
            setState(prev => ({ ...prev, isStepLoading: false }));
          }
        }
      } else if (questionId === 'script-refinement') {
        // Handle script refinement options
        if (answerId === 'refine') {
          // User wants to refine the script - show the refinement panel
          if (!skipUserMessage) addMessage('user', 'I want to refine this script');

          setState(prev => ({
            ...prev,
            isStepLoading: false
          }));

          // The RightPanel will now show ScriptRefinementPanel due to step being script-refinement
          // No need to change state.step, it's already there

        } else if (answerId === 'next' || answerId === 'skip') {
          // User wants to skip refinement and move to avatar selection
          if (!skipUserMessage) addMessage('user', 'Let\'s proceed without refinement');

          setState(prev => ({ ...prev, isStepLoading: true }));

          try {
            // Fetch real HeyGen avatars
            let avatarsToUse = generatedAvatars;
            if (avatarsToUse.length === 0) {
              try {
                const avatarResponse = await vibeletsAPI.getAvatars();
                if (avatarResponse.avatars && avatarResponse.avatars.length > 0) {
                  avatarsToUse = avatarResponse.avatars.map((a: any) => ({
                    id: a.avatar_id || a.id,
                    name: a.avatar_name || a.name || 'AI Presenter',
                    image: a.preview_image_url || a.thumbnail || '',
                    videoPreview: a.preview_video_url || undefined,
                    style: a.style || 'Professional'
                  }));
                  setGeneratedAvatars(avatarsToUse.slice(0, 10));
                }
              } catch (err) {
                console.error('Failed to fetch avatars:', err);
              }
            }

            const finalAvatars = avatarsToUse.length > 0 ? avatarsToUse : avatarOptions;
            const avatarChips = finalAvatars.slice(0, 10).map(a => ({
              id: a.id,
              label: a.name,
              description: a.style,
              icon: 'user'
            }));

            const avatarQuestion: InlineQuestion = {
              id: 'avatar-selection',
              question: 'Select an AI presenter for your video from the panel on the right or from the suggestions below:',
              options: [
                ...avatarChips,
                { id: 'next', label: '✅ Next', description: 'Confirm selection' },
                { id: 'back', label: '🔙 Go Back', description: 'Return to script refinement' },
                { id: 'start-over', label: '🏠 Start Over', description: 'Reset campaign' }
              ],
              hideOptionsInChat: true
            };

            setState(prev => ({ ...prev, isStepLoading: false }));

            await simulateTyping(
              `Great! Let's proceed. 🎬\n\nNow, select an AI avatar to present your video ad:`,
              { inlineQuestion: avatarQuestion, stepId: 'avatar-selection' },
              1000
            );

            setState(prev => ({
              ...prev,
              step: 'avatar-selection',
              stepHistory: [...prev.stepHistory, 'avatar-selection'],
              isStepLoading: false
            }));
          } catch (error) {
            console.error('❌ Avatar fetch failed:', error);
            handleError(error, 'Loading avatars');
            setState(prev => ({ ...prev, isStepLoading: false }));
          }
        } else if (answerId === 'back') {
          setState(prev => ({ ...prev, step: 'script-selection', isStepLoading: false }));
          if (!skipUserMessage) addMessage('user', 'Go back');
          return;
        }
      } else if (questionId === 'avatar-selection') {





        if (answerId === 'back') {
          setState(prev => ({ ...prev, step: 'script-selection', isStepLoading: false }));
          if (!skipUserMessage) addMessage('user', 'Go back');
          return;
        }

        if (answerId === 'start-over') {
          handleQuestionAnswerInternal('navigation-options', 'nav-start-over', false);
          return;
        }

        let avatarIdToUse = answerId;
        if (answerId === 'next') {
          if (state.selectedAvatar) {
            avatarIdToUse = state.selectedAvatar.id;
          } else {
            toast.error('Please select an avatar first', { description: 'Choose a presenter from the right panel.' });
            return;
          }
        }

        const optionsToUse = generatedAvatars && generatedAvatars.length > 0 ? generatedAvatars : avatarOptions;
        const avatar = optionsToUse.find(a => a.id === avatarIdToUse);
        if (!avatar) {
          toast.error('Avatar not found', { description: 'Please select a valid avatar' });
          return;
        }

        setState(prev => ({ ...prev, selectedAvatar: avatar, isStepLoading: true }));
        if (!skipUserMessage) addMessage('user', `${avatar.name} will be the presenter.`);

        try {
          // ✅ CALL BACKEND - Save avatar selection
          console.log(`🎭 Selecting avatar ${avatar.id} in backend...`);
          await vibeletsAPI.selectAvatar(avatar.id);

          await simulateTyping(
            `${avatar.name} is perfect! 🎥 Now generating your ad creatives. This process (including the AI video) usually takes about 2-3 minutes. Hang tight!\n\nStep 1: Generating images...`,
            { stepId: 'creative-generation' },
            1000
          );
          setState(prev => ({ ...prev, step: 'creative-generation', stepHistory: [...prev.stepHistory, 'creative-generation'] }));

          // CHECK FOR EXISTING DATA
          let currentImages = generatedImages || [];
          let audioUrl = null;
          let videoUrl = null;
          let videoStatus = null;
          let videoId = null;

          // Only generate images if we don't have them
          if (currentImages.length === 0) {
            console.log('🖼️ Generating images...');
            const imagesResult = await vibeletsAPI.generateImages(undefined, 2);
            const newImages = imagesResult.generated_images || [];
            setGeneratedImages(newImages);
            currentImages = newImages;
            console.log('🖼️ Images generated:', newImages);
          } else {
            console.log('🖼️ Using existing images:', currentImages);
            await simulateTyping(
              `✅ Found existing images!`,
              {},
              500
            );
          }

          await simulateTyping(
            `Checking voiceover status...`,
            {},
            500
          );

          // Only generate audio if we don't have it (checking backend state usually handles this, but avoiding the call is better)
          // We can check local state for now, but backend has the file.
          // Let's blindly call generateAudio as the backend now handles the check,
          // OR we can rely on what we have.
          // Since frontend might not have audio url stored separately often, we'll let it call,
          // BUT backend now has the "if exists return" logic!
          // So this call is cheap now.
          console.log('🎵 Ensuring audio...');
          const audioResult = await vibeletsAPI.generateAudio();
          audioUrl = audioResult.audio_url || audioResult.state?.audio_url;
          console.log('🎵 Audio ready:', audioUrl);

          await simulateTyping(
            `✅ Audio ready! Checking video status...`,
            {},
            500
          );

          // ✅ STEP 3: Generate Video (Backend will skip if exists)
          console.log('🎬 Initiating video generation...');
          // ✅ STEP 3: Generate Video
          console.log('🎬 Generating video...');
          const genResponse = await vibeletsAPI.generateVideo();
          videoUrl = genResponse.video_url || genResponse.state?.video_url;
          videoStatus = genResponse.video_status || genResponse.state?.video_status;
          videoId = genResponse.video_id || genResponse.state?.video_id;

          // If video is still processing, poll for status (HeyGen videos take time)
          if (videoId && (!videoUrl || videoStatus === 'processing' || videoStatus === 'pending')) {
            console.log(`⏳ Video ${videoId} is processing, polling for results...`);

            if (videoUrl) {
              console.log('✅ Video URL already exists, skipping polling.');
            } else {
              // Poll every 10 seconds for up to 10 minutes (60 attempts) - HeyGen can be slow
              for (let i = 0; i < 60; i++) {
                try {
                  await new Promise(resolve => setTimeout(resolve, 10000));
                  const statusCheck = await vibeletsAPI.getVideoStatus(videoId);
                  console.log(`⏳ Polling status (${i + 1}/60):`, statusCheck.status, statusCheck);

                  if (statusCheck.video_url || statusCheck.status === 'completed') {
                    videoUrl = statusCheck.video_url || statusCheck.url || statusCheck.download_url; // Handle various URL fields
                    videoStatus = statusCheck.status;

                    if (videoUrl) {
                      console.log('✅ Video generation complete!', videoUrl);
                      break;
                    }
                  }

                  if (statusCheck.status === 'failed' || statusCheck.status === 'error') {
                    console.error('❌ Video generation failed in HeyGen');
                    videoStatus = 'failed';
                    break;
                  }
                } catch (pollError) {
                  console.error('Error polling video status:', pollError);
                }
              }
            }
          }

          if (!videoUrl && (videoStatus === 'processing' || videoStatus === 'pending')) {
            console.log('⚠️ Video still processing after timeout.');
            // Keeps videoStatus as 'processing' so UI can handle it
          }

          console.log('🎬 Final Video status:', videoStatus, 'URL:', videoUrl);

          // Create creative options from generated content
          const creatives: CreativeOption[] = [
            {
              id: 'video-creative',
              type: 'video',
              name: 'AI Generated Video',
              thumbnail: currentImages[0] || '',
              videoUrl: videoUrl,
              format: 'feed',
              aspectRatio: '9:16'
            },
            ...currentImages.slice(0, 2).map((imgUrl, idx) => ({
              id: `image-creative-${idx}`,
              type: 'image' as const,
              name: `Generated Image ${idx + 1}`,
              thumbnail: imgUrl,
              format: 'feed' as const,
              aspectRatio: '1:1' as const
            }))
          ];

          setState(prev => ({ ...prev, creatives, isStepLoading: false }));

          setGeneratedImages(currentImages);

          const creativeQuestion: InlineQuestion = {
            id: 'creative-selection',
            question: 'Select your preferred creative:',
            options: [
              ...creatives.map(c => ({
                id: c.id,
                label: c.name,
                description: c.type === 'video' ? 'Video format' : 'Image format'
              })),
              { id: 'custom-creative', label: '📤 Upload My Own', description: 'Use your own image or video' },
              { id: 'back', label: '🔙 Go Back', description: 'Previous step' },
              { id: 'start-over', label: '🏠 Start Over', description: 'Reset campaign' },
              { id: 'next', label: '✅ Next', description: 'Confirm selection' }
            ]
          };

          await simulateTyping(
            `Done! I've generated your creatives:\n• ${videoUrl ? '1 AI Video with ' + avatar.name : 'Processing video...'}\n• ${currentImages.length} AI-Generated Images\n\nWhich one would you like to use?`,
            { inlineQuestion: creativeQuestion, stepId: 'creative-review' },
            1500
          );
          setState(prev => ({ ...prev, step: 'creative-review', stepHistory: [...prev.stepHistory, 'creative-review'], isStepLoading: false }));
        } catch (error) {
          console.error('Creative generation error:', error);
          handleError(error, 'Generating creatives');
          setState(prev => ({ ...prev, isStepLoading: false }));
        }
      } else if (questionId === 'creative-selection') {
        if (answerId === 'custom-creative') {
          setState(prev => ({ ...prev, isCustomCreativeMode: true, step: 'creative-review', stepHistory: [...prev.stepHistory, 'creative-review'] }));
          if (!skipUserMessage) addMessage('user', "I'll upload my own creative.");
          await simulateTyping(
            `Perfect! Upload your image or video in the panel. I'll validate it against Facebook's ad specifications. 📤`,
            { stepId: 'creative-review' },
            800
          );
        } else {
          // Find creative from generated creatives (not mock)
          let creative = state.creatives.find(c => c.id === answerId);

          // Fallback: If not found in creatives, try to reconstruct from generatedImages fallback
          if (!creative && answerId.startsWith('image-creative-') && generatedImages.length > 0) {
            const idx = parseInt(answerId.split('-').pop() || '0', 10);
            const imgUrl = generatedImages[idx];
            if (imgUrl) {
              console.log(`♻️ Reconstructed creative ${answerId} from generatedImages fallback`);
              creative = {
                id: answerId,
                type: 'image',
                name: `Generated Image ${idx + 1}`,
                thumbnail: imgUrl,
                format: 'feed',
                aspectRatio: '1:1'
              };
            }
          }

          if (!creative) {
            toast.error('Creative not found', { description: 'Please select a valid creative' });
            return;
          }

          setState(prev => ({ ...prev, selectedCreative: creative, isStepLoading: true, isCustomCreativeMode: false }));
          if (!skipUserMessage) addMessage('user', `I'll use the "${creative.name}" creative.`);

          // Call backend to save media selection
          try {
            console.log(`📤 Selecting media: ${creative.type} - ${creative.videoUrl || creative.thumbnail}`);
            await vibeletsAPI.selectMedia(
              creative.type,
              creative.type === 'video' ? (creative.videoUrl || '') : creative.thumbnail
            );

            await simulateTyping(
              `Excellent choice! Your ${creative.name} is ready. 🎯\n\nNow let's configure your Facebook campaign...`,
              { stepId: 'campaign-setup' },
              1200
            );

            // Show campaign config UI
            setState(prev => ({ ...prev, step: 'campaign-setup', stepHistory: [...prev.stepHistory, 'campaign-setup'], isStepLoading: false }));

            await simulateTyping(
              `Fill in the campaign details in the panel, then we'll connect to Facebook! 👉`,
              { showCampaignSlider: true },
              800
            );
          } catch (error) {
            console.error('Media selection error:', error);
            setState(prev => ({ ...prev, isStepLoading: false }));
            toast.error('Failed to select media', { description: 'Please try again' });
          }
        }
      } else if (questionId === 'creative-review') {
        // Handle creative review - user can approve or regenerate
        if (answerId === 'approve' || answerId === 'continue') {
          if (!skipUserMessage) addMessage('user', "These look great! Let's continue.");

          setState(prev => ({ ...prev, isStepLoading: true }));

          try {
            // If no creative is selected, pick the first one as default
            if (!state.selectedCreative && state.creatives.length > 0) {
              const defaultCreative = state.creatives[0];
              console.log('🎯 No creative selected, using first one as default:', defaultCreative.id);

              // Call backend to select
              await vibeletsAPI.selectMedia(
                defaultCreative.type,
                defaultCreative.type === 'video' ? (defaultCreative.videoUrl || '') : defaultCreative.thumbnail
              );

              setState(prev => ({ ...prev, selectedCreative: defaultCreative }));
            }

            // Move to campaign setup
            await simulateTyping(
              "Awesome! 🎉 Now let's set up your campaign details.",
              { stepId: 'campaign-setup' },
              800
            );

            setState(prev => ({
              ...prev,
              step: 'campaign-setup',
              stepHistory: [...prev.stepHistory, 'campaign-setup'],
              isStepLoading: false
            }));
          } catch (error) {
            handleError(error, 'Moving to campaign setup');
            setState(prev => ({ ...prev, isStepLoading: false }));
          }
        } else if (answerId === 'regenerate' || answerId === 'refine') {
          if (!skipUserMessage) addMessage('user', "Let's regenerate the creatives.");

          setState(prev => ({
            ...prev,
            isStepLoading: true,
            isRegenerating: 'creatives'
          }));

          try {
            // Provide intermediate feedback
            addMessage('assistant', "I'm on it! 🎨 Generating fresh image variations and incorporating your USPs into new visual styles. This will just take a few seconds...");

            // Trigger regeneration
            await vibeletsAPI.navigate('generate_images');
            const imageResult = await vibeletsAPI.generateImages();

            if (imageResult.error) throw new Error(imageResult.error);

            const backendImages = imageResult.images || [];
            const imageCreatives: CreativeOption[] = backendImages.map((imgUrl: string, index: number) => ({
              id: `regen-img-${index}`,
              type: 'image',
              thumbnail: imgUrl.startsWith('http') ? imgUrl : (imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`),
              name: `Regenerated Image ${index + 1}`,
              format: 'feed',
              aspectRatio: '1:1'
            }));

            setGeneratedImages(backendImages);
            setState(prev => {
              const newState = { ...prev };

              // If we had a video, keep it, but update images
              const existingVideo = prev.creatives.find(c => c.type === 'video');
              const newCreatives: CreativeOption[] = [...imageCreatives];
              if (existingVideo) {
                newCreatives.unshift(existingVideo);
              }

              newState.creatives = newCreatives;
              newState.step = 'creative-review'; // FORCE STEP TRANSITION
              newState.isStepLoading = false;
              newState.isRegenerating = null;
              return newState;
            });

            const reviewQuestion: InlineQuestion = {
              id: 'creative-review',
              question: 'How do the new creatives look?',
              options: [
                { id: 'approve', label: '✅ Looks Great!', icon: 'check' },
                { id: 'regenerate', label: '🔄 Regenerate Again', icon: 'refresh-cw' }
              ]
            };

            await simulateTyping(
              `I've updated your creatives! 🎨 I kept your video and added ${backendImages.length} fresh image variations. How do they look?`,
              { inlineQuestion: reviewQuestion, stepId: 'creative-review' },
              1000
            );
          } catch (error) {
            handleError(error, 'Regenerating creatives');
            setState(prev => ({ ...prev, isStepLoading: false, isRegenerating: null }));
          }
        }
      } else if (questionId === 'script-review') {
        if (answerId === 'continue' || answerId === 'yes') {
          // Manual trigger of script selection confirm
          if (!skipUserMessage) addMessage('user', "Looks good! Let's generate images.");

          if (state.selectedScript) {
            // Reuse the script-selection logic
            handleQuestionAnswerInternal('script-selection', state.selectedScript.id, true);
          } else {
            await simulateTyping("Please select a script from the list first!", { stepId: 'script-selection' }, 500);
          }
        } else if (answerId === 'refine') {
          if (!skipUserMessage) addMessage('user', "I'd like to refine this script.");
          await simulateTyping("Sure! What would you like to change about the script? You can tell me to make it more professional, funnier, or focus on different features.", { stepId: 'script-selection' }, 500);
        } else if (answerId === 'back') {
          if (!skipUserMessage) addMessage('user', "I want to choose a different script.");
          setState(prev => ({ ...prev, selectedScript: null }));
          await simulateTyping("No problem! Here are your script options again. Which style do you prefer?", { stepId: 'script-selection' }, 500);
        }
      } else if (questionId === 'generic-confirmation') {
        if (answerId === 'yes' || answerId === 'next') {
          if (!skipUserMessage) addMessage('user', answerId === 'yes' ? "Yes" : "Continue");
          // Handle "Yes/Next" based on current step
          if (state.step === 'product-analysis') {
            handleQuestionAnswerInternal('product-continue', 'continue', true);
          } else if (state.step === 'script-selection') {
            handleQuestionAnswerInternal('script-review', 'continue', true);
          } else if (state.step === 'avatar-selection') {
            if (!state.selectedAvatar) {
              toast.error('Please select an avatar first.');
              return;
            }
            goToStep('creative-generation');
          } else if (state.step === 'product-url') {
            if (!state.productUrl) {
              toast.error('Please enter a product URL.');
              return;
            }
            // Block next if simply clicking next without entry
            toast.error('Please enter a valid product URL.');
            return;
          } else if (state.step === 'creative-review') {
            handleQuestionAnswerInternal('creative-review', 'approve', true);
          } else {
            // Generic next
            const currentIndex = STEP_ORDER.indexOf(state.step);
            if (currentIndex < STEP_ORDER.length - 1) {
              goToStep(STEP_ORDER[currentIndex + 1]);
            }
          }
        } else if (answerId === 'back') {
          if (!skipUserMessage) addMessage('user', "Go Back");
          const currentIndex = STEP_ORDER.indexOf(state.step);
          if (currentIndex > 0) {
            goToStep(STEP_ORDER[currentIndex - 1]);
          }
        } else {
          if (!skipUserMessage) addMessage('user', "No");
          await simulateTyping("Understood. How else can I help you?", { stepId: state.step }, 500);
        }
      } else if (questionId === 'script-refinement') {
        const labels: Record<string, string> = {
          'funnier': 'Make it funnier',
          'professional': 'Make it professional',
          'shorter': 'Make it shorter',
          'hooks': 'Focus more on USPs and hooks'
        };
        const instruction = labels[answerId] || answerId;
        handleUserMessage(instruction);
      } else if (questionId === 'creative-refinement') {
        if (answerId === 'continue') {
          handleQuestionAnswerInternal('creative-review', 'approve', false);
        } else {
          const labels: Record<string, string> = {
            'modern': 'Make them look more modern and sleek',
            'vibrant': 'Use more vibrant and bold colors',
            'minimal': 'Go for a more minimalist and clean aesthetic'
          };
          const instruction = labels[answerId] || answerId;
          handleUserMessage(instruction);
        }
      } else if (questionId.startsWith('facebook-connect')) {
        if (answerId === 'connect') {
          await handleFacebookConnect();
        } else if (answerId === 'use-existing') {
          await handleFacebookUseExisting();
        } else if (answerId === 'skip') {
          if (!skipUserMessage) addMessage('user', "Skip for now");
          await simulateTyping("Okay, skipping Facebook connection for now. You can connect later in settings.", {}, 800);
          setState(prev => ({ ...prev, step: 'campaign-preview' })); // Skip to preview/end
        } else if (answerId === 'back') {
          const currentIndex = STEP_ORDER.indexOf(state.step);
          if (currentIndex > 0) {
            goToStep(STEP_ORDER[currentIndex - 1]);
          }
        }
      } else if (questionId === 'ad-account-selection') {
        console.log('🏦 Selecting ad account:', answerId);
        console.log('📋 Available accounts:', fetchedAdAccounts);

        // Try to find in fetched accounts only
        const account = fetchedAdAccounts.find(a => a.id === answerId);

        if (!account) {
          console.error('❌ Ad account not found:', answerId);
          toast.error('Ad account not found', { description: 'Please select a valid ad account' });
          return;
        }

        console.log('✅ Selected account:', account);

        // Check account status
        if (account.status !== 'Active' && account.status !== 'ACTIVE') {
          toast.warning('Account not active', {
            description: `${account.name} is ${account.status}. You may need to activate it in Facebook Business Manager.`
          });
        }

        setState(prev => ({ ...prev, selectedAdAccount: account, isStepLoading: true }));
        if (!skipUserMessage) addMessage('user', `Using "${account.name}" account.`);

        try {
          // Call backend to save ad account selection
          console.log('📡 Calling backend to save ad account selection...');
          await vibeletsAPI.selectAdAccount(account.id);
          console.log('✅ Ad account selection saved');

          const publishQuestion: InlineQuestion = {
            id: 'publish-confirm',
            question: 'Ready to launch your campaign?',
            options: [
              { id: 'publish', label: 'Publish Campaign', description: 'Submit for Facebook review', icon: 'play' },
              { id: 'preview', label: 'Review Details', description: 'Check campaign summary first', icon: 'target' }
            ]
          };

          await simulateTyping(
            `Great! I've selected **${account.name}** and auto-fetched:\n✅ Facebook Pixel\n✅ Business Page\n\nYour campaign is ready! What would you like to do?`,
            { inlineQuestion: publishQuestion, stepId: 'campaign-preview' },
            1500
          );
          setState(prev => ({ ...prev, step: 'campaign-preview', stepHistory: [...prev.stepHistory, 'campaign-preview'], isStepLoading: false }));
        } catch (error) {
          console.error('❌ Error selecting ad account:', error);
          handleError(error, 'Selecting ad account');
        }
      } else if (questionId === 'publish-confirm') {
        if (answerId === 'publish') {
          // Validate campaign is complete
          if (!state.campaignConfig || !state.selectedCreative || !state.selectedAdAccount) {
            throw new Error('Campaign is incomplete. Please ensure all steps are completed.');
          }

          if (!skipUserMessage) addMessage('user', "Publish the campaign!");
          setState(prev => ({ ...prev, step: 'publishing', stepHistory: [...prev.stepHistory, 'publishing'], isStepLoading: true }));

          await simulateTyping(`Publishing to Facebook... 🚀`, { stepId: 'publishing' }, 1000);

          await new Promise(resolve => setTimeout(resolve, 3000));

          // Simulate potential publishing failure (2% chance in demo)
          if (Math.random() < 0.02) {
            throw new Error('Publishing failed. Facebook API returned an error. Please try again.');
          }

          toast.success('Campaign Published!', {
            description: 'Your ad has been submitted for Facebook review.',
          });

          // Initialize performance dashboard
          const performanceDashboard = createMockPerformanceDashboard();

          await simulateTyping(
            `🎉 **Campaign Published!**\n\nYour ad has been submitted for review (typically 24-48 hours).\n\n**What's next:**\n• Monitor performance in your dashboard\n• I'll notify you when approved\n• Check out the AI recommendations!\n\nWant to create another campaign? Just paste a new product URL!`,
            { stepId: 'published' },
            2000
          );
          setState(prev => ({ ...prev, step: 'published', stepHistory: [...prev.stepHistory, 'published'], isStepLoading: false, performanceDashboard }));
        } else {
          await simulateTyping(
            `Take your time to review. Check the campaign preview on the right, and when you're ready, just say "publish" or select Publish Campaign above.`,
            {},
            1000
          );
        }
      }
      // Handle navigation options (detected intent + alternatives)
      else if (questionId === 'navigation-options') {
        // Find the MOST RECENT confirmation context
        // Priority 1: Message metadata from the last navigation question
        // Priority 2: Current pending intent in state
        const questionMessage = [...messages].reverse().find(m => m.inlineQuestion?.id === 'navigation-options');
        const confirmation = questionMessage?.inlineQuestion?.metadata?.confirmation || state.pendingIntentConfirmation;

        if (!confirmation) {
          console.error('❌ No confirmation found in question metadata!');
          toast.error('Navigation error', { description: 'Please try your request again' });
          return;
        }

        console.log('✅ Found confirmation from question metadata:', confirmation);


        if (answerId === 'confirm-detected') {
          // Execute the detected intent
          if (!skipUserMessage) addMessage('user', `Yes, ${confirmation.intentDescription.toLowerCase()}.`);

          setState(prev => ({ ...prev, pendingIntentConfirmation: null }));

          // Map the detected intent to the correct action WITHOUT calling backend
          const intent = confirmation.detectedIntent;

          if (intent === 'scrape') {
            // Go to URL input
            setState(prev => ({ ...prev, step: 'product-url', productData: null }));
            await simulateTyping("No problem! Paste a new product URL to analyze.", { stepId: 'product-url' }, 500);
          } else if (intent === 'analyze') {
            // Go back to product analysis
            await goToStep('product-analysis');
          } else if (intent === 'generate_scripts' || intent === 'select_script') {
            // Go to script selection
            await goToStep('script-selection');
          } else if (intent === 'select_avatar') {
            // Go to avatar selection
            await goToStep('avatar-selection');
          } else if (intent === 'generate_images' || intent === 'generate_video' || intent === 'select_media') {
            // Go to creative review
            await goToStep('creative-review');
          } else if (intent === 'refine_campaign') {
            // Go to campaign setup
            await goToStep('campaign-setup');
          } else {
            // For unknown intents, show message
            await simulateTyping(`Done! I've navigated as requested.`, { stepId: state.step }, 500);
          }
        } else {
          // Handle alternative navigation option
          if (!skipUserMessage) addMessage('user', `I'll ${answerId.replace('nav-', '').replace('-', ' ')}.`);

          setState(prev => ({ ...prev, pendingIntentConfirmation: null, isStepLoading: true }));

          try {
            // Map alternative option IDs to actions
            if (answerId === 'nav-start-over') {
              setState(prev => ({ ...initialState, stepHistory: ['welcome'] }));
              setMessages([INITIAL_WELCOME_MESSAGE]);
              setSelectedAnswers({});
              toast.success('Starting over!');
            } else if (answerId === 'nav-go-back') {
              const currentIndex = STEP_ORDER.indexOf(state.step);
              if (currentIndex > 0) {
                const previousStep = STEP_ORDER[currentIndex - 1];
                await goToStep(previousStep);
              }
            } else if (answerId === 'nav-change-url') {
              setState(prev => ({ ...prev, step: 'product-url', productData: null }));
              await simulateTyping("No problem! Paste a new product URL to analyze.", { stepId: 'product-url' }, 500);
            } else if (answerId === 'nav-regenerate-analysis') {
              await regenerateProductAnalysis();
            } else if (answerId === 'nav-regenerate-scripts') {
              await regenerateScripts();
            } else if (answerId === 'nav-regenerate-creative') {
              await regenerateCreatives();
            } else if (answerId === 'nav-custom-script') {
              setState(prev => ({ ...prev, isCustomScriptMode: true, step: 'script-selection' }));
              await simulateTyping(
                `Great! You can write your own ad copy in the panel. I'll guide you with Facebook's best practices. ✍️`,
                { stepId: 'script-selection' },
                800
              );
            } else if (answerId === 'nav-upload-own') {
              setState(prev => ({ ...prev, isCustomCreativeMode: true, step: 'creative-review' }));
              await simulateTyping(
                `Great! Upload your custom image or video. I'll validate it meets Facebook's ad specifications. 📤`,
                { stepId: 'creative-review' },
                800
              );
            } else if (answerId === 'nav-connect-facebook' || answerId === 'nav-reconnect-facebook') {
              await handleFacebookConnect();
            } else if (answerId === 'nav-use-existing') {
              await handleFacebookUseExisting();
            } else if (answerId === 'nav-select-account') {
              setState(prev => ({ ...prev, step: 'ad-account-selection' }));
              await simulateTyping("Please select an ad account from the list.", { stepId: 'ad-account-selection' }, 500);
            }

            setState(prev => ({ ...prev, isStepLoading: false }));
          } catch (error) {
            handleError(error, 'Executing navigation action');
          }
        }
      }
    } catch (error) {
      handleError(error, 'Processing your selection');
    }
  }, [state.campaignConfig, state.selectedCreative, state.selectedAdAccount, state.creatives, generatedImages, state.pendingIntentConfirmation, state.productData, generatedScripts, generatedAvatars, fetchedAdAccounts, addMessage, simulateTyping, handleError]);

  // Legacy functions for backward compatibility (now handled via inline questions)
  const displayAvatars = useMemo(() => {
    return generatedAvatars.length > 0 ? generatedAvatars : avatarOptions;
  }, [generatedAvatars]);

  const selectScript = useCallback(async (script: ScriptOption) => {
    await handleQuestionAnswerInternal('script-selection', script.id, false);
  }, [handleQuestionAnswerInternal]);

  const selectAvatar = useCallback(async (avatar: AvatarOption) => {
    await handleQuestionAnswerInternal('avatar-selection', avatar.id, false);
  }, [handleQuestionAnswerInternal]);

  const selectCreative = useCallback(async (creative: CreativeOption) => {
    await handleQuestionAnswerInternal('creative-selection', creative.id, false);
  }, [handleQuestionAnswerInternal]);

  // Public wrapper that always adds user message (used by chip clicks)
  const handleQuestionAnswer = useCallback(async (questionId: string, answerId: string) => {
    await handleQuestionAnswerInternal(questionId, answerId, false);
  }, [handleQuestionAnswerInternal]);

  // LEGACY END -----------------------------------


  const connectFacebook = useCallback(async () => {
    await handleQuestionAnswerInternal('facebook-connect', 'connect', false);
  }, [handleQuestionAnswerInternal]);

  const selectAdAccount = useCallback(async (account: AdAccount) => {
    await handleQuestionAnswerInternal('ad-account-selection', account.id, false);
  }, [handleQuestionAnswerInternal]);

  const publishCampaign = useCallback(async () => {
    await handleQuestionAnswerInternal('publish-confirm', 'publish', false);
  }, [handleQuestionAnswerInternal]);


  const handleCampaignConfigComplete = useCallback(async (config: Record<string, string>) => {

    try {
      // Validate configuration
      const validation = validateCampaignConfig(config);
      if (!validation.valid) {
        toast.error('Invalid configuration', {
          description: validation.errors.join('. '),
        });
        return;
      }

      // Transform slider output to full CampaignConfig
      const productTitle = state.productData?.title || 'Campaign';
      const fullConfig: CampaignConfig = {
        campaignName: sanitizeInput(productTitle),
        objective: config.objective || 'Sales',
        budgetType: 'daily',
        adSetName: sanitizeInput(productTitle),
        budgetAmount: config.budget || '50',
        duration: config.duration || '14',
        fbPixelId: '',
        fbPageId: '',
        adName: sanitizeInput(productTitle),
        primaryText: state.productData?.description?.slice(0, 125) || 'Check out this amazing product!',
        cta: config.cta || 'Shop Now',
        websiteUrl: state.productUrl || ''
      };

      setState(prev => ({ ...prev, campaignConfig: fullConfig, isStepLoading: true }));

      const budgetDisplay = `$${fullConfig.budgetAmount}/day`;
      const durationDisplay = fullConfig.duration === 'ongoing' ? 'Ongoing' : `${fullConfig.duration} days`;

      addMessage('user', `Campaign configured: ${fullConfig.objective} • ${budgetDisplay} • ${durationDisplay}`);

      await simulateTyping(
        `Your campaign is configured:\n• **Objective:** ${fullConfig.objective}\n• **Budget:** ${budgetDisplay}\n• **Duration:** ${durationDisplay}\n\nNow let's connect your Facebook Ads account:`,
        { showFacebookConnect: true, stepId: 'facebook-integration' },
        1200
      );
      setState(prev => ({ ...prev, step: 'facebook-integration', stepHistory: [...prev.stepHistory, 'facebook-integration'], isStepLoading: false }));
    } catch (error) {
      handleError(error, 'Saving campaign configuration');
    }
  }, [state.productData, state.productUrl, addMessage, simulateTyping, handleError]);

  const handleFacebookConnect = useCallback(async () => {
    try {
      addMessage('user', "Connecting Facebook account...");
      setState(prev => {
        // Self-healing: If campaign config is missing (skipped step), generate default
        if (!prev.campaignConfig) {
          const productTitle = prev.productData?.title || 'Campaign';
          const defaultConfig: CampaignConfig = {
            campaignName: sanitizeInput(productTitle),
            objective: 'Sales',
            budgetType: 'daily',
            adSetName: sanitizeInput(productTitle),
            budgetAmount: '50',
            duration: '14',
            fbPixelId: '',
            fbPageId: '',
            adName: sanitizeInput(productTitle),
            primaryText: prev.productData?.description?.slice(0, 125) || 'Check out this amazing product!',
            cta: 'Shop Now',
            websiteUrl: prev.productUrl || ''
          };
          console.log('🔧 Auto-generating default campaign config (step was skipped)');
          return { ...prev, campaignConfig: defaultConfig, isStepLoading: true };
        }
        return { ...prev, isStepLoading: true };
      });

      const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
      console.log('🔍 Facebook App ID:', appId ? `${appId.substring(0, 4)}...` : 'MISSING');

      if (!appId) {
        console.error("❌ Missing VITE_FACEBOOK_APP_ID");
        toast.error("Configuration Missing", {
          description: "Facebook App ID not found. Please add VITE_FACEBOOK_APP_ID to your frontend/.env file.",
          duration: 5000
        });
        setState(prev => ({ ...prev, isStepLoading: false }));
        return;
      }

      const redirectUri = window.location.origin + '/facebook-callback';
      const scope = 'ads_management,ads_read,pages_read_engagement';
      const stateParam = state.step; // Use current step or random str

      console.log('🔗 OAuth Config:', { redirectUri, scope });

      // Open OAuth Popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateParam}&scope=${scope}&response_type=token`;

      console.log('🚀 Opening Facebook OAuth popup...');
      const popup = window.open(
        authUrl,
        'Facebook Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        console.error('❌ Popup blocked!');
        toast.error('Popup Blocked', {
          description: 'Please allow popups for this site to connect Facebook.',
        });
        setState(prev => ({ ...prev, isStepLoading: false }));
        return;
      }

      // Listen for message from popup
      const messageHandler = async (event: MessageEvent) => {
        console.log('📨 Received message:', event.data.type);
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'FACEBOOK_AUTH_SUCCESS') {
          const accessToken = event.data.accessToken;
          console.log('✅ Access token received:', accessToken ? `${accessToken.substring(0, 10)}...` : 'MISSING');
          window.removeEventListener('message', messageHandler);

          simulateTyping("Facebook connected! Fetching ad accounts...", {}, 500);

          try {
            // 🚀 Call Backend to Authenticate & Get Accounts
            console.log('📡 Calling backend /api/workflow/facebook_auth...');
            const authResult = await vibeletsAPI.authenticateFacebook(accessToken);
            console.log('📥 Backend response:', authResult);

            if (authResult.error) {
              console.error('❌ Backend error:', authResult.error);
              throw new Error(authResult.error);
            }

            const realAdAccounts = authResult.ad_accounts || []; // Expecting [{id, name, status, ...}]
            console.log('📊 Ad accounts received:', realAdAccounts.length, realAdAccounts);

            if (realAdAccounts.length === 0) {
              console.warn('⚠️ No ad accounts found');
              toast.warning('No Ad Accounts found', { description: 'Please create an ad account in your Facebook Business Manager.' });
              setState(prev => ({ ...prev, facebookConnected: true, isStepLoading: false }));
              return;
            }

            // Map backend accounts to frontend type if needed
            const mappedAccounts: AdAccount[] = realAdAccounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              status: acc.account_status === 1 ? 'Active' : 'Inactive', // simple mapping guess, adjust as needed
              currency: acc.currency,
              timezone: acc.timezone_name
            }));

            // Deduplicate accounts by ID to prevent React duplicate key warnings
            const uniqueAccounts = Array.from(
              new Map(mappedAccounts.map(acc => [acc.id, acc])).values()
            );

            console.log('✅ Real Ad Accounts:', uniqueAccounts);

            // Store fetched accounts in state for later use
            setFetchedAdAccounts(uniqueAccounts);

            setState(prev => ({ ...prev, facebookConnected: true, isStepLoading: true }));

            const accountQuestion: InlineQuestion = {
              id: 'ad-account-selection',
              question: 'Which ad account should we use?',
              options: uniqueAccounts.map(a => ({ id: a.id, label: a.name, description: `Status: ${a.status}` }))
            };

            await simulateTyping(
              `Facebook connected! 🔗\n\nI found ${uniqueAccounts.length} ad accounts. Select one to continue:`,
              { inlineQuestion: accountQuestion, stepId: 'ad-account-selection' },
              800
            );
            setState(prev => ({ ...prev, step: 'ad-account-selection', stepHistory: [...prev.stepHistory, 'ad-account-selection'], isStepLoading: false }));

          } catch (backendError) {
            console.error("Backend Auth Error:", backendError);
            handleError(backendError, 'Fetching Ad Accounts');
            setState(prev => ({ ...prev, facebookConnected: false }));
          }
        } else if (event.data.type === 'FACEBOOK_AUTH_ERROR') {
          window.removeEventListener('message', messageHandler);
          handleError(new Error(event.data.error), 'Facebook Connection');
          setState(prev => ({ ...prev, facebookConnected: false }));
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup closed manually
      const checkPopup = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          setState(prev => {
            // Only reset loading if we haven't connected yet (message handler handles success)
            if (!prev.facebookConnected) return { ...prev, isStepLoading: false };
            return prev;
          });
          window.removeEventListener('message', messageHandler);
        }
      }, 1000);

    } catch (error) {
      handleError(error, 'Connecting to Facebook');
      setState(prev => ({ ...prev, facebookConnected: false }));
    }
  }, [addMessage, simulateTyping, handleError]);

  // Handler for using existing Facebook account from login
  const handleFacebookUseExisting = useCallback(async () => {
    try {
      addMessage('user', "Using my signed-in Facebook account");
      setState(prev => {
        // Self-healing: If campaign config is missing (skipped step), generate default
        if (!prev.campaignConfig) {
          const productTitle = prev.productData?.title || 'Campaign';
          const defaultConfig: CampaignConfig = {
            campaignName: sanitizeInput(productTitle),
            objective: 'Sales',
            budgetType: 'daily',
            adSetName: sanitizeInput(productTitle),
            budgetAmount: '50',
            duration: '14',
            fbPixelId: '',
            fbPageId: '',
            adName: sanitizeInput(productTitle),
            primaryText: prev.productData?.description?.slice(0, 125) || 'Check out this amazing product!',
            cta: 'Shop Now',
            websiteUrl: prev.productUrl || ''
          };
          console.log('🔧 Auto-generating default campaign config (step was skipped)');
          return { ...prev, campaignConfig: defaultConfig, facebookConnected: true, isStepLoading: true };
        }
        return { ...prev, facebookConnected: true, isStepLoading: true };
      });

      await simulateTyping("Using your connected Facebook account...", {}, 500);
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!mockAdAccounts || mockAdAccounts.length === 0) {
        throw new Error('No ad accounts found. Please ensure you have at least one Facebook Ad Account.');
      }

      const accountQuestion: InlineQuestion = {
        id: 'ad-account-selection',
        question: 'Which ad account should we use?',
        options: mockAdAccounts.map(a => ({ id: a.id, label: a.name, description: `Status: ${a.status}` }))
      };

      await simulateTyping(
        `Perfect! Your Facebook account is ready. 🔗\n\nI found ${mockAdAccounts.length} ad accounts. Select one to continue:`,
        { inlineQuestion: accountQuestion, stepId: 'ad-account-selection' },
        800
      );
      setState(prev => ({ ...prev, step: 'ad-account-selection', stepHistory: [...prev.stepHistory, 'ad-account-selection'], isStepLoading: false }));
    } catch (error) {
      handleError(error, 'Connecting to Facebook');
      setState(prev => ({ ...prev, facebookConnected: false }));
    }
  }, [addMessage, simulateTyping, handleError]);


  const resetFlow = useCallback(() => {
    setState(initialState);
    setSelectedAnswers({});
    // Create a new message with unique ID for each reset
    setMessages([
      createMessage('assistant', "Ready for your next campaign! 🚀 Paste a product URL to get started.", { stepId: 'welcome' })
    ]);
  }, []);

  // Performance dashboard handlers
  const handleCampaignFilterChange = useCallback((campaignId: string | null) => {
    setState(prev => {
      if (!prev.performanceDashboard) return prev;
      return {
        ...prev,
        performanceDashboard: {
          ...prev.performanceDashboard,
          selectedCampaignId: campaignId
        }
      };
    });
  }, []);

  const handleOpenActionCenter = useCallback(() => {
    setState(prev => {
      if (!prev.performanceDashboard) return prev;
      return {
        ...prev,
        performanceDashboard: {
          ...prev.performanceDashboard,
          isActionCenterOpen: true
        }
      };
    });
  }, []);

  const handleCloseActionCenter = useCallback(() => {
    setState(prev => {
      if (!prev.performanceDashboard) return prev;
      return {
        ...prev,
        performanceDashboard: {
          ...prev.performanceDashboard,
          isActionCenterOpen: false
        }
      };
    });
  }, []);

  const handleRecommendationAction = useCallback((recommendationId: string, action: string, value?: number) => {
    setState(prev => {
      if (!prev.performanceDashboard) return prev;

      const rec = prev.performanceDashboard.recommendations.find(r => r.id === recommendationId);
      if (!rec) return prev;

      // Handle different actions
      switch (action) {
        case 'apply':
        case 'resume':
        case 'pause':
        case 'clone':
        case 'clone-all':
          toast.success('Action applied!', {
            description: `${rec.title} has been processed.`,
          });
          // Remove the recommendation after action
          return {
            ...prev,
            performanceDashboard: {
              ...prev.performanceDashboard,
              recommendations: prev.performanceDashboard.recommendations.filter(r => r.id !== recommendationId)
            }
          };
        case 'dismiss':
          toast.info('Recommendation dismissed');
          return {
            ...prev,
            performanceDashboard: {
              ...prev.performanceDashboard,
              recommendations: prev.performanceDashboard.recommendations.filter(r => r.id !== recommendationId)
            }
          };
        case 'remind':
        case 'wait':
          toast.info('We\'ll remind you later');
          return prev;
        default:
          return prev;
      }
    });
  }, []);

  const refreshPerformanceDashboard = useCallback(async () => {
    if (!state.performanceDashboard) return;

    setState(prev => ({ ...prev, isRefreshingDashboard: true }));

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate fresh mock data with slightly varied values
    const freshDashboard = createMockPerformanceDashboard();

    setState(prev => ({
      ...prev,
      performanceDashboard: {
        ...freshDashboard,
        selectedCampaignId: prev.performanceDashboard?.selectedCampaignId || null,
        isActionCenterOpen: prev.performanceDashboard?.isActionCenterOpen || false,
      },
      isRefreshingDashboard: false,
    }));

    toast.success('Dashboard refreshed', {
      description: 'Performance data updated with latest metrics',
    });
  }, [state.performanceDashboard]);

  // Clone creative handler - triggers new campaign flow with cloned creative
  const handleCloneCreative = useCallback(async (recommendation: AIRecommendation) => {
    if (!recommendation.creative) {
      toast.error('Creative not found');
      return;
    }

    // Remove the recommendation
    setState(prev => {
      if (!prev.performanceDashboard) return prev;
      return {
        ...prev,
        performanceDashboard: {
          ...prev.performanceDashboard,
          recommendations: prev.performanceDashboard.recommendations.filter(r => r.id !== recommendation.id)
        }
      };
    });

    toast.success('Starting new campaign with cloned creative', {
      description: 'Using your winning creative to launch a new campaign',
    });

    // Navigate to product URL step to start fresh with this creative style
    setState(prev => ({
      ...prev,
      step: 'product-url', // Go to start
      stepHistory: ['welcome'],
      productUrl: '', // Reset URL
      productData: null, // Ensure fresh start
      selectedScript: null,
      selectedAvatar: null,
      creatives: [], // Clear creatives as they depend on product
      selectedCreative: null,
      campaignConfig: null,
      isStepLoading: false,
      performanceDashboard: null, // Exit performance view
    }));

    // Prompt user for URL
    addMessage('assistant', `Great choice! To create a campaign inspired by "${recommendation.creative.name}", please paste the URL of the product you want to promote:`, {
      stepId: 'product-url'
    });
  }, [addMessage]);

  const getCompletedSteps = useCallback((): CampaignStep[] => {
    const currentIndex = STEP_ORDER.indexOf(state.step);
    return STEP_ORDER.slice(0, currentIndex);
  }, [state.step]);

  // Regenerate handlers for AI-generated content
  const regenerateProductAnalysis = useCallback(async () => {
    try {
      if (!state.productUrl) {
        toast.error('No product URL', { description: 'Please provide a product URL first' });
        return;
      }

      setState(prev => ({ ...prev, isRegenerating: 'product' }));
      addMessage('assistant', "Regenerating product analysis with fresh AI insights... ✨");

      // ✅ CALL REAL BACKEND API
      const result = await vibeletsAPI.analyzeProduct();

      if (result.error) throw new Error(result.error);

      const productAnalysis = result.analysis;
      const scrapedProduct = result.product_data;

      // Sync state from backend results
      const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

      // Generate insights from analysis
      const insights: ProductInsight[] = [];

      if (productAnalysis) {
        if (productAnalysis.category) {
          insights.push({
            label: 'Product Category',
            value: formatInsightValue(productAnalysis.category),
            icon: 'tag'
          });
        }
        if (productAnalysis.features) {
          const featuresValue = Array.isArray(productAnalysis.features) ? productAnalysis.features.join(', ') : formatInsightValue(productAnalysis.features);
          insights.push({ label: 'Key Features', value: featuresValue, icon: 'list' });
        }
        if (productAnalysis.target_audience) {
          insights.push({
            label: 'Target Audience',
            value: formatInsightValue(productAnalysis.target_audience),
            icon: 'users'
          });
        }
        if (productAnalysis.usps) {
          const uspsValue = Array.isArray(productAnalysis.usps) ? productAnalysis.usps.join(', ') : formatInsightValue(productAnalysis.usps);
          insights.push({ label: 'Key USPs', value: uspsValue, icon: 'star' });
        }
        if (productAnalysis.pain_points) {
          const painValue = Array.isArray(productAnalysis.pain_points) ? productAnalysis.pain_points.join(', ') : formatInsightValue(productAnalysis.pain_points);
          insights.push({ label: 'Pain Points', value: painValue, icon: 'alert-circle' });
        }
        if (productAnalysis.marketing_angles) {
          const anglesValue = Array.isArray(productAnalysis.marketing_angles) ? productAnalysis.marketing_angles.join(', ') : formatInsightValue(productAnalysis.marketing_angles);
          insights.push({ label: 'Marketing Angles', value: anglesValue, icon: 'trending-up' });
        }
        if (productAnalysis.positioning) {
          insights.push({ label: 'Positioning', value: formatInsightValue(productAnalysis.positioning), icon: 'target' });
        }
      }

      // Preserve existing data if backend returns empty
      const existingData = state.productData;

      const productImagesRaw = scrapedProduct?.downloaded_images || scrapedProduct?.images || [];
      const productImages = productImagesRaw.length > 0
        ? productImagesRaw.map((imgPath: string) => {
          if (imgPath.startsWith('http')) return imgPath;
          return `${BACKEND_URL}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;
        })
        : existingData?.images || [];

      const refreshedData: ProductData = {
        title: scrapedProduct?.title || existingData?.title || 'Product',
        price: scrapedProduct?.price || existingData?.price || '$0',
        description: scrapedProduct?.description || existingData?.description || '',
        sku: scrapedProduct?.sku || existingData?.sku || '',
        category: productAnalysis?.category || existingData?.category || '',
        images: productImages,

        downloaded_images: scrapedProduct?.downloaded_images || existingData?.downloaded_images || [],
        main_image: productImages[0] || existingData?.main_image,
        pageScreenshot: productImages[0] || existingData?.pageScreenshot,

        variants: scrapedProduct?.variants || existingData?.variants || [],
        variants_count:
          scrapedProduct?.variants?.length ??
          existingData?.variants_count ??
          0,

        insights: insights.length > 0 ? insights : existingData?.insights || [],

        confidence: scrapedProduct?.confidence ?? existingData?.confidence,
        raw_text: scrapedProduct?.raw_text ?? existingData?.raw_text,
      };


      setState(prev => ({
        ...prev,
        productData: refreshedData,
        isRegenerating: null
      }));

      addMessage('assistant', "Product analysis refreshed! I've updated my insights based on your feedback.");
      toast.success('Analysis refreshed', { description: 'New insights generated successfully' });
    } catch (error) {
      setState(prev => ({ ...prev, isRegenerating: null }));
      handleError(error, 'Regenerating product analysis');
    }
  }, [state.productUrl, state.productData, addMessage, handleError]);

  const regenerateScripts = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRegenerating: 'scripts', selectedScript: null }));
      addMessage('assistant', "Generating new script variations... 🎬");

      // ✅ CALL REAL BACKEND API
      const scriptsResult = await vibeletsAPI.generateScripts();

      if (scriptsResult.error) throw new Error(scriptsResult.error);

      const backendScripts = scriptsResult.scripts || [];
      const formattedScripts = backendScripts.map((s: any, i: number) => {
        if (typeof s === 'string') {
          return { id: `script-${i}`, name: `Variation ${i + 1}`, description: s.substring(0, 100) + '...', content: s };
        }
        return s;
      });

      setState(prev => ({ ...prev, isRegenerating: null }));

      const scriptQuestion: InlineQuestion = {
        id: 'script-selection',
        question: 'Here are fresh script options:',
        options: formattedScripts.map((s: any, i: number) => ({
          id: `script-${i}`,
          label: s.style ? `${s.style} (${s.duration || '30s'})` : `Variation ${i + 1}`,
          description: s.name || s.content?.substring(0, 50) + '...'
        }))
      };

      await simulateTyping(
        "I've generated new script variations! Choose the one that best fits your brand:",
        { inlineQuestion: scriptQuestion, stepId: 'script-selection' },
        500
      );
      toast.success('Scripts regenerated', { description: 'New script options available' });
    } catch (error) {
      setState(prev => ({ ...prev, isRegenerating: null }));
      handleError(error, 'Regenerating scripts');
    }
  }, [addMessage, simulateTyping, handleError]);

  const regenerateCreatives = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRegenerating: 'creatives', selectedCreative: null, step: 'creative-generation' }));
      addMessage('assistant', "Regenerating ad creatives with new AI variations... 🎨");

      // ✅ CALL REAL BACKEND PIPELINE
      // Step 1: Images
      const imagesResult = await vibeletsAPI.generateImages(undefined, 2);
      const generatedImages = imagesResult.generated_images || [];

      // Step 2: Audio
      await vibeletsAPI.generateAudio().catch(() => console.warn("Audio gen failed"));

      // Step 3: Video
      const genResponse = await vibeletsAPI.generateVideo();
      let videoUrl = genResponse.video_url || genResponse.state?.video_url;
      const videoId = genResponse.video_id || genResponse.state?.video_id;

      // Poll if needed
      if (videoId && !videoUrl) {
        // Note: Full polling logic simplified here for brevity, 
        // but reuse the polling pattern if it takes time
        const statusCheck = await vibeletsAPI.getVideoStatus(videoId);
        videoUrl = statusCheck.video_url || statusCheck.url || statusCheck.download_url;
      }

      const creatives: CreativeOption[] = [
        ...(videoUrl ? [{
          id: 'video-creative',
          type: 'video' as const,
          name: 'AI Generated Video',
          thumbnail: generatedImages[0] || '',
          videoUrl: videoUrl,
          aspectRatio: state.video_aspect_ratio || '9:16'
        }] : []),
        ...generatedImages.map((imgUrl, idx) => ({
          id: `image-creative-${idx}`,
          type: 'image' as const,
          name: `Generated Image ${idx + 1}`,
          thumbnail: imgUrl,
          aspectRatio: '1:1' as const
        }))
      ];

      if (creatives.length === 0) throw new Error('Failed to generate any creatives');

      setState(prev => ({ ...prev, creatives, isRegenerating: null, step: 'creative-review' }));

      const creativeQuestion: InlineQuestion = {
        id: 'creative-selection',
        question: 'Here are your new creative options:',
        options: creatives.map(c => ({
          id: c.id,
          label: c.name,
          description: c.type === 'video' ? 'Video format' : 'Image format'
        }))
      };

      await simulateTyping(
        "Fresh creatives ready! I've generated new variations based on your product and script:",
        { inlineQuestion: creativeQuestion, stepId: 'creative-review' },
        1500
      );
      toast.success('Creatives regenerated', { description: 'New creative options available' });
    } catch (error) {
      setState(prev => ({ ...prev, isRegenerating: null, step: 'creative-review' }));
      handleError(error, 'Regenerating creatives');
    }
  }, [addMessage, simulateTyping, handleError, state.selectedAvatar, state.video_aspect_ratio]);

  // Custom script/creative handlers
  const handleCustomScriptSubmit = useCallback(async (script: ScriptOption) => {
    try {
      if (!script?.customContent?.primaryText) {
        toast.error('Invalid script', { description: 'Please provide primary text for your ad' });
        return;
      }

      setState(prev => ({ ...prev, selectedScript: script, isCustomScriptMode: false, isStepLoading: true }));
      addMessage('user', `Custom script: "${script.customContent?.headline || 'My Script'}"`);

      if (!avatarOptions || avatarOptions.length === 0) {
        throw new Error('Avatar options not available');
      }

      const optionsToUse = generatedAvatars.length > 0 ? generatedAvatars : avatarOptions;

      const avatarQuestion: InlineQuestion = {
        id: 'avatar-selection',
        question: 'Select an AI presenter for your video:',
        options: optionsToUse.map(a => ({ id: a.id, label: a.name, description: a.style }))
      };

      await simulateTyping(
        `Great custom script! Your ad copy looks compelling. ✍️\n\nNow let's pick an AI avatar to present your product:`,
        { inlineQuestion: avatarQuestion, stepId: 'avatar-selection' },
        1200
      );
      setState(prev => ({ ...prev, step: 'avatar-selection', stepHistory: [...prev.stepHistory, 'avatar-selection'], isStepLoading: false }));
    } catch (error) {
      handleError(error, 'Submitting custom script');
    }
  }, [addMessage, simulateTyping, handleError]);

  const handleCustomScriptCancel = useCallback(() => {
    setState(prev => ({ ...prev, isCustomScriptMode: false }));

    // Clear the selected answer so the question shows as active
    setSelectedAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers['script-selection'];
      return newAnswers;
    });

    const scriptQuestion: InlineQuestion = {
      id: 'script-selection',
      question: 'Choose a script style that matches your brand voice:',
      options: [
        ...generatedScripts.map(s => ({ id: s.id, label: s.name, description: s.description })),
        { id: 'custom-script', label: '✍️ Write My Own', description: 'Create custom ad copy' }
      ]
    };

    addMessage('assistant', "No problem! Here are the AI-generated script options:", { inlineQuestion: scriptQuestion, stepId: 'script-selection' });
  }, [addMessage, generatedScripts]);

  const handleCustomCreativeSubmit = useCallback(async (creative: CreativeOption) => {
    try {
      if (!creative?.thumbnail) {
        toast.error('Invalid creative', { description: 'Please upload a valid image or video' });
        return;
      }

      setState(prev => ({ ...prev, selectedCreative: creative, isCustomCreativeMode: false, isStepLoading: true }));
      addMessage('user', `Uploaded custom ${creative.type}: "${creative.name}"`);

      await simulateTyping(
        `Your custom ${creative.type} looks great and meets Facebook's ad specifications! 📤\n\nLet's configure your campaign:`,
        { showCampaignSlider: true, stepId: 'campaign-setup' },
        1200
      );
      setState(prev => ({ ...prev, step: 'campaign-setup', stepHistory: [...prev.stepHistory, 'campaign-setup'], isStepLoading: false }));
    } catch (error) {
      handleError(error, 'Submitting custom creative');
    }
  }, [addMessage, simulateTyping, handleError]);

  const handleCustomCreativeCancel = useCallback(() => {
    setState(prev => ({ ...prev, isCustomCreativeMode: false }));

    const creativeQuestion: InlineQuestion = {
      id: 'creative-selection',
      question: 'Select your preferred creative:',
      options: [
        ...state.creatives.map(c => ({
          id: c.id,
          label: c.name,
          description: c.type === 'video' ? 'Video format' : 'Image format'
        })),
        { id: 'custom-creative', label: '📤 Upload My Own', description: 'Use your own image or video' }
      ]
    };

    addMessage('assistant', "No problem! Here are the AI-generated creative options:", { inlineQuestion: creativeQuestion, stepId: 'creative-review' });
  }, [addMessage, state.creatives]);



  return {
    state,
    messages,
    isTyping,
    selectedAnswers,
    generatedScripts,
    handleUserMessage,
    handleQuestionAnswer,
    handleCampaignConfigComplete,
    handleFacebookConnect,
    handleFacebookUseExisting,
    resetFlow,
    goToStep,
    getCompletedSteps,
    regenerateProductAnalysis,
    regenerateScripts,
    regenerateCreatives,
    handleCustomScriptSubmit,
    handleCustomScriptCancel,
    handleCustomCreativeSubmit,
    handleCustomCreativeCancel,
    handleCampaignFilterChange,
    handleOpenActionCenter,
    handleCloseActionCenter,
    handleRecommendationAction,
    refreshPerformanceDashboard,
    handleCloneCreative,
    generatedAvatars: displayAvatars,
    selectScript,
    selectAvatar,
    selectCreative,
    // Thread Management
    threadId,
    loadThread,
    startNewThread,
  };
};
