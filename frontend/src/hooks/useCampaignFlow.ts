import { useState, useCallback, useMemo, useEffect } from 'react';
import { CampaignState, CampaignStep, Message, ProductData, ScriptOption, AvatarOption, CreativeOption, CampaignConfig, AdAccount, InlineQuestion, AIRecommendation, ProductInsight, IntentConfirmation, QuestionOption } from '@/types/campaign';
import { mockCreatives, avatarOptions, mockAdAccounts, campaignObjectives, ctaOptions, scriptOptions, mockProductData } from '@/data/mockData';
import { createMockPerformanceDashboard } from '@/data/mockPerformanceData';
import { toast } from 'sonner';
import { isValidUrl, sanitizeInput, validateCampaignConfig, formatErrorMessage } from '@/lib/validation';
import { matchUserInputToOption, looksLikeUrl, detectNavigationIntent } from '@/lib/nlpMatcher';
import { vibeletsAPI } from '@/lib/api';
import { getIntentDescription, getAlternativeNavigationOptions, shouldConfirmIntent } from '@/lib/navigationHelper';

const STEP_ORDER: CampaignStep[] = [
  'welcome',
  'product-url',
  'product-analysis',
  'script-selection',
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

export const useCampaignFlow = () => {
  const [state, setState] = useState<CampaignState>(initialState);
  const [messages, setMessages] = useState<Message[]>([INITIAL_WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [generatedScripts, setGeneratedScripts] = useState<ScriptOption[]>([]);
  const [generatedAvatars, setGeneratedAvatars] = useState<AvatarOption[]>([]);
  const [fetchedAdAccounts, setFetchedAdAccounts] = useState<AdAccount[]>([]);

  // Find the active question that can receive natural language input
  // Find the active question that can receive natural language input
  const activeQuestion: InlineQuestion | null = useMemo(() => {
    // Map current step to allowed question IDs to ensure relevance
    const stepToQuestionId: Record<string, string[]> = {
      'product-analysis': ['product-continue'],
      'script-selection': ['script-selection'],
      'creative-generation': ['creative-selection'],
      'creative-generation:images': ['creative-selection'],
      // Allow 'creative-selection' for all creative substeps if consistent, or specific IDs
      'avatar-selection': ['avatar-selection'],
      'ad-account-selection': ['ad-account-selection'],
      'publish-campaign': ['publish-confirm'],
      'campaign-creation': ['campaign-input']
    };

    const allowedIds = stepToQuestionId[state.step] || [];

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
    addMessage('assistant', `Sorry, something went wrong while ${context.toLowerCase()}. Please try again or contact support if the issue persists.`);
  }, [addMessage]);

  // Sync state from backend response
  const syncStateFromBackend = useCallback((backendState: any) => {
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

        const mappedStep = stepMapping[backendState.current_step] || backendState.current_step as CampaignStep;

        // Only update if it's a valid frontend step
        if (STEP_ORDER.includes(mappedStep)) {
          newState.step = mappedStep;
          if (!newState.stepHistory.includes(mappedStep)) {
            newState.stepHistory = [...newState.stepHistory, mappedStep];
          }
        }
      }

      // Update data fields
      if (backendState.product_data) {
        newState.productData = backendState.product_data;

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
      }
      if (backendState.selected_script) newState.selectedScript = backendState.selected_script;

      // Handle generated scripts
      if (backendState.scripts && Array.isArray(backendState.scripts)) {
        // Frontend expects specific format, might need conversion if not matching
        // Assuming backend returns array of strings, we need to map to ScriptOption if not already done
        const formattedScripts: ScriptOption[] = backendState.scripts.map((scriptText: string, index: number) => {
          // Check if it's already an object or just string
          if (typeof scriptText === 'object') return scriptText;

          // Parse style from content if available e.g. [Style: Fast-paced]
          const styleMatch = scriptText.match(/\[Style:\s*(.*?)\]/i);
          const parsedStyle = styleMatch ? styleMatch[1] : 'Engaging';

          const cleanBody = scriptText.replace(/\[Style:\s*.*?\]/i, '').trim();
          const desc = cleanBody.length > 100 ? cleanBody.substring(0, 100) + '...' : cleanBody;

          return {
            id: `script-${index}`,
            name: `Script ${index + 1}`,
            description: desc,
            duration: '30-60 seconds',
            style: parsedStyle,
            body: scriptText,
            hook: cleanBody.split('\n')[0] || '',
            cta: 'Shop Now',
            tone: 'Professional'
          };
        });
        setGeneratedScripts(formattedScripts);
      }

      if (backendState.generated_images) newState.generatedImages = backendState.generated_images;

      // Handle error from backend state
      if (backendState.error) {
        toast.error(backendState.error);
      }

      return newState;
    });
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        console.log('🔄 Attempting to restore session...');
        const result = await vibeletsAPI.getCurrentState();

        if (result && result.state) {
          console.log('✅ Session restored:', result.state);
          // Sync data (Insights, Scripts, etc.)
          syncStateFromBackend(result.state);

          // Reconstruct UI state based on restored step
          // We need to ensure the user has the relevant prompt/chips for the current step
          const currentStep = result.state.current_step;

          let restoreMessage = null;
          let restoreOptions = {};

          if (currentStep === 'script-selection') {
            restoreMessage = "I've restored your generated scripts. Select one from the right panel to proceed.";
            restoreOptions = {
              inlineQuestion: {
                id: 'script-selection',
                text: 'Which script would you like to use?',
                type: 'single-select',
                options: [
                  { id: 'script-1', label: 'Script 1', value: '0' },
                  { id: 'script-2', label: 'Script 2', value: '1' },
                  { id: 'script-3', label: 'Script 3', value: '2' }
                ]
              },
              stepId: 'script-selection'
            };
          } else if (currentStep === 'product-analysis') {
            restoreMessage = "Here is your product analysis. Ready to generate scripts?";
            restoreOptions = {
              inlineQuestion: {
                id: 'product-continue',
                text: 'Would you like to generate ad scripts based on this analysis?',
                type: 'confirm',
                options: [
                  { id: 'generate-scripts', label: 'Generate Scripts', value: 'yes' }
                ]
              },
              stepId: 'product-analysis'
            };
          }
          // Add other steps as needed...

          if (restoreMessage) {
            // Add restoration message to chat
            // We use specific delay to ensure it appears after welcome
            setTimeout(() => {
              setMessages(prev => {
                // Avoid duplicates checks?
                return [...prev, createMessage('assistant', restoreMessage, restoreOptions)];
              });
            }, 500);
          }
        }
      } catch (err) {
        console.warn("Failed to restore session:", err);
      }
    };

    // Check if we have a thread first
    if (localStorage.getItem('vibelets_thread_id')) {
      restoreSession();
    }
  }, [syncStateFromBackend]);


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
      // Clear old product data when analyzing new URL
      setState(prev => ({
        ...prev,
        productUrl: potentialUrl,
        productData: null,  // Clear old data
        step: 'product-analysis',
        isStepLoading: true
      }));

      await simulateTyping("Perfect! Analyzing your product page now... 🔍", { stepId: 'product-analysis' }, 1000);

      try {
        // CALL BACKEND - Scrape product
        const scrapeResult = await vibeletsAPI.scrapeProduct(potentialUrl);

        if (scrapeResult.error) {
          throw new Error(scrapeResult.error);
        }

        const scrapedProduct = scrapeResult.product_data;

        // CALL BACKEND - Analyze product
        const analysisResult = await vibeletsAPI.analyzeProduct();

        if (analysisResult.error) {
          throw new Error(analysisResult.error);
        }

        const productAnalysis = analysisResult.analysis;

        // Helper function to format insight values
        const formatInsightValue = (value: any): string => {
          if (typeof value === 'string') {
            return value;
          } else if (Array.isArray(value)) {
            return value.join(', ');
          } else if (typeof value === 'object' && value !== null) {
            return Object.entries(value)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
          }
          return String(value);
        };

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
          if (productAnalysis.marketing_angles) {
            const anglesValue = Array.isArray(productAnalysis.marketing_angles) ? productAnalysis.marketing_angles.join(', ') : formatInsightValue(productAnalysis.marketing_angles);
            insights.push({ label: 'Marketing Angles', value: anglesValue, icon: 'trending-up' });
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
          images: productImages,
          sku: scrapedProduct?.sku || '',
          category: productAnalysis?.category || scrapedProduct?.category || '',
          pageScreenshot: productImages[0] || '',
          insights: insights,
        };

        setState(prev => ({ ...prev, productData, isStepLoading: false }));

        const continueQuestion: InlineQuestion = {
          id: 'product-continue',
          question: 'Ready to create your ad?',
          options: [
            { id: 'continue', label: 'Continue', description: 'Proceed to script selection' },
            { id: 'change', label: 'Change URL', description: 'Use a different product' }
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

    try {
      console.log('📤 Calling backend chat API with message:', sanitizedContent);
      const response = await vibeletsAPI.chat(sanitizedContent);
      console.log('📥 Backend response:', response);

      if (response.error) {
        throw new Error(response.error);
      }

      // Check if it's a support response
      if (response.is_support_response) {
        // Inform user about redirection
        addMessage('assistant', "Redirecting to Help & Support... 💬");

        // Short delay for user to see the message
        await new Promise(resolve => setTimeout(resolve, 1000));

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
      if (['change_url', 'start_over', 'restart', 'new_url'].includes(navigationIntent)) {
        console.log('🔄 Resetting flow for new product');
        setState(prev => ({
          ...prev,
          step: 'product-url',
          productUrl: '',
          productData: null,
          generatedScripts: [],
          selectedAnswers: {}, // Clear selected answers to reset flow
          isStepLoading: false
        }));

        await simulateTyping(response.message || "Ready for a new product! Paste your product URL below.", { stepId: 'product-url' }, 500);
        return;
      }

      // DIRECT NAVIGATION - No loading, no re-analyzing
      if (navigationIntent === 'back' || navigationIntent === 'previous' ||
        navigationIntent === 'next' || navigationIntent === 'continue') {

        // Map backend step to frontend step
        const stepMapping: Record<string, CampaignStep> = {
          'product-url': 'product-url',
          'product-analysis': 'product-analysis',
          'script-selection': 'script-selection',
          'creative-generation': 'creative-generation',
          'avatar-selection': 'avatar-selection',
          'facebook-auth': 'facebook-integration',
          'ad-account-selection': 'ad-account-selection',
          'campaign-creation': 'campaign-preview'
        };

        const newStep = stepMapping[response.current_step] || response.current_step as CampaignStep;

        // UPDATE STATE: Sync with backend (important for scripts/avatars)
        if (response.state) {
          syncStateFromBackend(response.state);
        }

        // Ensure step is correct and loading is off
        setState(prev => ({
          ...prev,
          step: newStep,
          isStepLoading: false
        }));

        // Show the backend's message
        await simulateTyping(response.message, { stepId: newStep }, 500);
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
        await simulateTyping(response.message, { stepId: state.step }, 500);
      }

    } catch (error) {
      handleError(error, 'Processing your message');
    }
  }, [state.step, addMessage, handleError, syncStateFromBackend, simulateTyping]);


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
        // ... (existing reset logic) ...
        if (targetIndex <= STEP_ORDER.indexOf('product-analysis')) {
          newState.productData = null;
          newState.selectedScript = null;
          newState.selectedAvatar = null;
          newState.creatives = [];
          newState.selectedCreative = null;
          newState.campaignConfig = null;
          newState.facebookConnected = false;
          newState.selectedAdAccount = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('script-selection')) {
          newState.selectedScript = null;
          newState.selectedAvatar = null;
          newState.creatives = [];
          newState.selectedCreative = null;
          newState.campaignConfig = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('avatar-selection')) {
          newState.selectedAvatar = null;
          newState.creatives = [];
          newState.selectedCreative = null;
          newState.campaignConfig = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('creative-review')) {
          newState.selectedCreative = null;
          newState.campaignConfig = null;
        } else if (targetIndex <= STEP_ORDER.indexOf('campaign-setup')) {
          newState.campaignConfig = null;
        }
        newState.stepHistory = [...prev.stepHistory, targetStep];
        return newState;
      });

      addMessage('assistant', `No problem! Let's go back and make changes. ${getStepPrompt(targetStep)}`, { stepId: targetStep });

      // Notify backend of navigation (best effort)
      try {
        // Map frontend step back to backend step name
        const backendStepMapping: Record<CampaignStep, string> = {
          'product-url': 'scrape',
          'product-analysis': 'analyze',
          'script-selection': 'script-selection',
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

  const getStepPrompt = (step: CampaignStep): string => {
    const prompts: Record<CampaignStep, string> = {
      'welcome': "Paste your product URL to begin.",
      'product-url': "Paste a new product URL.",
      'product-analysis': "Analyzing your product...",
      'script-selection': "Choose a script style for your ad.",
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
      if (questionId !== 'navigation-options') {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));
      }


      if (questionId === 'product-continue') {
        if (answerId === 'continue') {
          if (!skipUserMessage) addMessage('user', "Let's continue!");
          setState(prev => ({ ...prev, isStepLoading: true }));

          try {
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
              // Backend returns plain text scripts, not objects
              // Use first 100 chars as description, full text as body
              const desc = scriptText.length > 100 ? scriptText.substring(0, 100) + '...' : scriptText;

              return {
                id: `script-${index}`,
                name: `Script ${index + 1}`,
                description: desc,
                duration: '30-60 seconds',
                style: 'Engaging',
                body: scriptText,  // Store full script text here
                hook: scriptText.split('\n')[0] || '',  // First line as hook
                cta: 'Shop Now',
                tone: 'Professional'
              };
            });

            console.log('🎬 Formatted scripts:', formattedScripts);
            setGeneratedScripts(formattedScripts);

            // Helper function to format insight values
            const formatInsightValue = (value: any): string => {
              if (typeof value === 'string') {
                return value;
              } else if (Array.isArray(value)) {
                return value.join(', ');
              } else if (typeof value === 'object' && value !== null) {
                // Format object as readable text instead of JSON
                return Object.entries(value)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ');
              }
              return String(value);
            };

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

            const productImages = (scrapedProduct?.downloaded_images || scrapedProduct?.images || []).map((imgPath: string) => {
              // If path already has http, return as is
              if (imgPath.startsWith('http')) {
                return imgPath;
              }
              // Add backend URL prefix to relative paths
              const fullUrl = `${BACKEND_URL}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;
              console.log('🔍 Image path transformation:', imgPath, '→', fullUrl);
              return fullUrl;
            });

            console.log('🔍 Final product images:', productImages);

            const productData: ProductData = {
              title: scrapedProduct?.title || 'Product',
              price: scrapedProduct?.price || '$0',
              description: scrapedProduct?.description || '',
              images: productImages, // Images with full URLs
              sku: scrapedProduct?.sku || '',
              category: productAnalysis?.category || scrapedProduct?.category || '',
              pageScreenshot: productImages[0] || '', // Use first image as screenshot
              insights: insights,
            };

            setState(prev => ({ ...prev, productData, isStepLoading: false }));

            const scriptQuestion: InlineQuestion = {
              id: 'script-selection',
              question: 'Choose a script style that matches your brand voice:',
              options: [
                ...formattedScripts.map(s => ({ id: s.id, label: s.name, description: s.description })),
                { id: 'custom-script', label: '✍️ Write My Own', description: 'Create custom ad copy' }
              ]
            };

            await simulateTyping(
              `Great! I've generated ${formattedScripts.length} script options for you. Each one tells your product's story in a unique way:`,
              { inlineQuestion: scriptQuestion, stepId: 'script-selection' },
              800
            );
            setState(prev => ({ ...prev, step: 'script-selection', stepHistory: [...prev.stepHistory, 'script-selection'], isStepLoading: false }));
          } catch (error) {
            console.error('Script generation error:', error);
            setState(prev => ({ ...prev, isStepLoading: false }));
            throw error;
          }
        } else {
          if (!skipUserMessage) addMessage('user', "I want to change the product URL.");
          // Clear the selected answer for product-continue so the new inline question will show
          setSelectedAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers['product-continue'];
            return newAnswers;
          });
          setState(prev => ({ ...prev, step: 'product-url', productUrl: null, productData: null }));
          await simulateTyping("No problem! Paste a new product URL to analyze.", { stepId: 'product-url' }, 500);
        }
      } else if (questionId === 'script-selection') {
        if (answerId === 'custom-script') {
          setState(prev => ({ ...prev, isCustomScriptMode: true, step: 'script-selection', stepHistory: [...prev.stepHistory, 'script-selection'] }));
          if (!skipUserMessage) addMessage('user', "I'll write my own script.");
          await simulateTyping(
            `Great! You can write your own ad copy in the panel. I'll guide you with Facebook's best practices for character limits. ✍️`,
            { stepId: 'script-selection' },
            800
          );
        } else {
          const script = generatedScripts.find(s => s.id === answerId);
          if (!script) {
            toast.error('Script not found', { description: 'Please select a valid script option' });
            return;
          }

          setState(prev => ({ ...prev, selectedScript: script, isStepLoading: true, isCustomScriptMode: false }));
          if (!skipUserMessage) addMessage('user', `I'll use the "${script.name}" script.`);

          try {
            // CALL BACKEND - Save script selection
            const scriptIndex = parseInt(answerId.split('-')[1]);
            console.log(`📝 Selecting script ${scriptIndex} in backend...`);
            await vibeletsAPI.selectScript(scriptIndex);

            // FETCH REAL AVATARS FROM API
            let avatarsToUse: AvatarOption[] = [];

            try {
              console.log('🎭 Fetching real avatars from HeyGen...');
              const avatarResult = await vibeletsAPI.getAvatars();
              const fetchedAvatars = avatarResult.avatars || [];

              if (fetchedAvatars.length > 0) {
                console.log(`✅ Loaded ${fetchedAvatars.length} real avatars`);
                avatarsToUse = fetchedAvatars.map((a: any) => ({
                  id: a.avatar_id || a.id,
                  name: a.avatar_name || a.name || 'AI Presenter',
                  style: 'HeyGen Avatar',
                  image: a.preview_image_url || a.image_url || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=600&fit=crop',
                  videoPreview: a.preview_video_url || a.video_url
                }));
              } else {
                console.log('⚠️ No real avatars found, using custom placeholders');
                avatarsToUse = [
                  {
                    id: 'custom-1',
                    name: 'Custom Video 1',
                    style: 'Professional (Pre-recorded)',
                    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=60'
                  },
                  {
                    id: 'custom-2',
                    name: 'Custom Video 2',
                    style: 'Casual (Pre-recorded)',
                    image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&auto=format&fit=crop&q=60'
                  }
                ];
              }
            } catch (err) {
              console.error('Error fetching real avatars:', err);
              avatarsToUse = [
                {
                  id: 'custom-1',
                  name: 'Custom Video 1',
                  style: 'Professional',
                  image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=60'
                }
              ];
            }

            // Deduplicate avatars by ID to prevent React duplicate key warnings
            const uniqueAvatars = Array.from(
              new Map(avatarsToUse.map(avatar => [avatar.id, avatar])).values()
            );

            setGeneratedAvatars(uniqueAvatars);
            console.log('🎭 Avatar selection options ready');

            const avatarQuestion: InlineQuestion = {
              id: 'avatar-selection',
              question: 'Select a pre-recorded video slot:',
              options: uniqueAvatars.map(a => ({ id: a.id, label: a.name, description: a.style }))
            };

            await simulateTyping(
              `Great choice! The ${script.name} style is proven to drive conversions. 🎬\n\n${avatarsToUse[0]?.id.startsWith('custom')
                ? "Since we're in custom mode, select which video slot you'd like to use:"
                : "Now, select an AI presenter for your video:"}`,
              { inlineQuestion: avatarQuestion, stepId: 'avatar-selection' },
              1200
            );
            setState(prev => ({ ...prev, step: 'avatar-selection', stepHistory: [...prev.stepHistory, 'avatar-selection'], isStepLoading: false }));
          } catch (error) {
            console.error('Avatar fetching error:', error);
            // Fallback to mock avatars on error
            console.log('⚠️ Error fetching avatars, using mock data');
            const avatarsToUse = avatarOptions;

            const avatarQuestion: InlineQuestion = {
              id: 'avatar-selection',
              question: 'Select an AI presenter for your video:',
              options: avatarsToUse.map(a => ({ id: a.id, label: a.name, description: a.style }))
            };

            await simulateTyping(
              `Great choice! The ${script.name} style is proven to drive conversions. 🎬\n\nNow let's pick an AI avatar to present your product:`,
              { inlineQuestion: avatarQuestion, stepId: 'avatar-selection' },
              1200
            );
            setState(prev => ({ ...prev, step: 'avatar-selection', stepHistory: [...prev.stepHistory, 'avatar-selection'], isStepLoading: false }));
          }
        }
      } else if (questionId === 'avatar-selection') {
        const avatar = avatarOptions.find(a => a.id === answerId) || generatedAvatars.find(a => a.id === answerId);
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
            `${avatar.name} is perfect! 🎥 Now generating your ad creatives...\n\nStep 1: Generating images...`,
            { stepId: 'creative-generation' },
            1000
          );
          setState(prev => ({ ...prev, step: 'creative-generation', stepHistory: [...prev.stepHistory, 'creative-generation'] }));

          // ✅ STEP 1: Generate Images
          console.log('🖼️ Generating images...');
          const imagesResult = await vibeletsAPI.generateImages(undefined, 2);
          const generatedImages = imagesResult.generated_images || [];
          console.log('🖼️ Images generated:', generatedImages);

          await simulateTyping(
            `✅ Images ready! Now generating audio voiceover...`,
            {},
            800
          );

          // ✅ STEP 2: Generate Audio
          console.log('🎵 Generating audio...');
          const audioResult = await vibeletsAPI.generateAudio();
          const audioUrl = audioResult.audio_url || audioResult.state?.audio_url;
          console.log('🎵 Audio generated:', audioUrl);

          await simulateTyping(
            `✅ Audio complete! Now creating your video with ${avatar.name}...`,
            {},
            800
          );

          // ✅ STEP 3: Generate Video
          // ✅ STEP 3: Generate Video
          console.log('🎬 Generating video...');
          const genResponse = await vibeletsAPI.generateVideo();
          let videoUrl = genResponse.video_url || genResponse.state?.video_url;
          let videoStatus = genResponse.video_status || genResponse.state?.video_status;
          const videoId = genResponse.video_id || genResponse.state?.video_id;

          // If video is still processing, poll for status (HeyGen videos take time)
          if (videoId && (!videoUrl || videoStatus === 'processing' || videoStatus === 'pending')) {
            console.log(`⏳ Video ${videoId} is processing, polling for results...`);

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
              thumbnail: generatedImages[0] || '',
              videoUrl: videoUrl,
              format: 'feed',
              aspectRatio: '9:16'
            },
            ...generatedImages.slice(0, 2).map((imgUrl, idx) => ({
              id: `image-creative-${idx}`,
              type: 'image' as const,
              name: `Generated Image ${idx + 1}`,
              thumbnail: imgUrl,
              format: 'feed' as const,
              aspectRatio: '1:1' as const
            }))
          ];

          setState(prev => ({ ...prev, creatives, generatedImages, isStepLoading: false }));

          const creativeQuestion: InlineQuestion = {
            id: 'creative-selection',
            question: 'Select your preferred creative:',
            options: [
              ...creatives.map(c => ({
                id: c.id,
                label: c.name,
                description: c.type === 'video' ? 'Video format' : 'Image format'
              })),
              { id: 'custom-creative', label: '📤 Upload My Own', description: 'Use your own image or video' }
            ]
          };

          await simulateTyping(
            `Done! I've generated your creatives:\n• ${videoUrl ? '1 AI Video with ' + avatar.name : 'Processing video...'}\n• ${generatedImages.length} AI-Generated Images\n\nWhich one would you like to use?`,
            { inlineQuestion: creativeQuestion, stepId: 'creative-review' },
            1500
          );
          setState(prev => ({ ...prev, step: 'creative-review', stepHistory: [...prev.stepHistory, 'creative-review'], isStepLoading: false }));
        } catch (error) {
          console.error('Creative generation error, using fallback:', error);

          // Fallback to mock creatives so the flow doesn't stop
          const fallbackVideoUrl = "https://cdn.pixabay.com/video/2022/11/20/140027-773738049_large.mp4";

          const fallbackCreatives: CreativeOption[] = [
            {
              id: 'video-creative',
              type: 'video',
              name: 'Mock Video (Fallback)',
              thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60',
              videoUrl: fallbackVideoUrl,
              format: 'feed',
              aspectRatio: '9:16'
            },
            {
              id: 'fallback-image-1',
              type: 'image',
              name: 'Fallback Image 1',
              thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60',
              format: 'feed',
              aspectRatio: '1:1'
            },
            {
              id: 'fallback-image-2',
              type: 'image',
              name: 'Fallback Image 2',
              thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60',
              format: 'feed',
              aspectRatio: '1:1'
            }
          ];

          setState(prev => ({ ...prev, creatives: fallbackCreatives, isStepLoading: false }));

          toast.warning('Generation incomplete', {
            description: 'Some creatives failed to generate. Showing placeholders instead.'
          });

          const creativeQuestion: InlineQuestion = {
            id: 'creative-selection',
            question: 'Select your preferred creative:',
            options: [
              ...fallbackCreatives.map(c => ({
                id: c.id,
                label: c.name,
                description: c.type === 'video' ? 'Video format' : 'Image format'
              })),
              { id: 'custom-creative', label: '📤 Upload My Own', description: 'Use your own image or video' }
            ]
          };

          await simulateTyping(
            `I encountered a glitch generating new assets, so I've prepared some placeholders. 🛠️\n\nWhich creative would you like to use for the campaign?`,
            { inlineQuestion: creativeQuestion, stepId: 'creative-review' },
            1000
          );
          setState(prev => ({ ...prev, step: 'creative-review', stepHistory: [...prev.stepHistory, 'creative-review'], isStepLoading: false }));
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

          // Fallback: If not found in creatives, try to reconstruct from generatedImages
          if (!creative && answerId.startsWith('image-creative-') && state.generatedImages) {
            const idx = parseInt(answerId.split('-').pop() || '0', 10);
            const imgUrl = state.generatedImages[idx];
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
            setState(prev => ({ ...prev, step: 'campaign-setup', stepHistory: [...prev.stepHistory, 'campaign-setup'], isStepLoading: false, showCampaignSlider: true }));

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
      } else if (questionId === 'ad-account-selection') {
        console.log('🏦 Selecting ad account:', answerId);
        console.log('📋 Available accounts:', fetchedAdAccounts);

        // Try to find in fetched accounts first, fallback to mock
        const account = fetchedAdAccounts.find(a => a.id === answerId) || mockAdAccounts.find(a => a.id === answerId);

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
        // Find the confirmation from the message with this question
        const questionMessage = messages.find(m => m.inlineQuestion?.id === 'navigation-options');
        const confirmation = questionMessage?.inlineQuestion?.metadata?.confirmation;

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
  }, [state.campaignConfig, state.selectedCreative, state.selectedAdAccount, state.creatives, state.generatedImages, state.pendingIntentConfirmation, generatedScripts, generatedAvatars, fetchedAdAccounts, addMessage, simulateTyping, handleError]);

  // Public wrapper that always adds user message (used by chip clicks)
  const handleQuestionAnswer = useCallback(async (questionId: string, answerId: string) => {
    await handleQuestionAnswerInternal(questionId, answerId, false);
  }, [handleQuestionAnswerInternal]);

  // Legacy functions for backward compatibility (now handled via inline questions)
  const selectScript = useCallback(async (script: ScriptOption) => {
    await handleQuestionAnswerInternal('script-selection', script.id, false);
  }, [handleQuestionAnswerInternal]);

  const selectAvatar = useCallback(async (avatar: AvatarOption) => {
    await handleQuestionAnswerInternal('avatar-selection', avatar.id, false);
  }, [handleQuestionAnswerInternal]);

  const selectCreative = useCallback(async (creative: CreativeOption) => {
    await handleQuestionAnswerInternal('creative-selection', creative.id, false);
  }, [handleQuestionAnswerInternal]);

  const setCampaignConfig = useCallback(async (config: CampaignConfig) => {
    // Config is now set via inline questions step by step
  }, []);

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
      setState(prev => ({ ...prev, isStepLoading: true }));

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
      setState(prev => ({ ...prev, facebookConnected: true, isStepLoading: true }));

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

    // Notify user in chat
    addMessage('assistant', `Great choice! Let's create a new campaign using your winning "${recommendation.creative.name}" creative. 🎯\n\nSince we're cloning from an existing campaign, the product is already set. Let's select a new script style:`, {
      inlineQuestion: {
        id: 'script-selection',
        question: 'Choose a script style for your new campaign:',
        options: [
          ...scriptOptions.map(s => ({ id: s.id, label: s.name, description: s.description })),
          { id: 'custom-script', label: '✍️ Write My Own', description: 'Create custom ad copy' }
        ]
      },
      stepId: 'script-selection'
    });

    // Set up the flow for a cloned creative campaign
    setState(prev => ({
      ...prev,
      step: 'script-selection',
      stepHistory: ['welcome', 'product-url', 'product-analysis', 'script-selection'],
      productUrl: 'https://cloned-from-campaign.com',
      productData: mockProductData, // Reuse existing product data
      selectedScript: null,
      selectedAvatar: null,
      creatives: [{
        id: 'cloned-creative',
        type: recommendation.creative!.thumbnail.includes('video') ? 'video' : 'image',
        thumbnail: recommendation.creative!.thumbnail,
        name: `${recommendation.creative!.name} (Cloned)`,
        isCloned: true
      }],
      selectedCreative: null,
      campaignConfig: null,
      facebookConnected: prev.facebookConnected,
      selectedAdAccount: prev.selectedAdAccount,
      isStepLoading: false,
      performanceDashboard: null, // Exit performance view
    }));
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

      await new Promise(resolve => setTimeout(resolve, 2500));

      const refreshedData = {
        ...mockProductData,
        insights: mockProductData.insights?.map(insight => ({
          ...insight,
          value: insight.value
        }))
      };

      setState(prev => ({ ...prev, productData: refreshedData, isRegenerating: null }));
      addMessage('assistant', "Product analysis refreshed! I've generated new insights based on the latest AI models.");
      toast.success('Analysis refreshed', { description: 'New insights generated successfully' });
    } catch (error) {
      handleError(error, 'Regenerating product analysis');
    }
  }, [state.productUrl, addMessage, handleError]);

  const regenerateScripts = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRegenerating: 'scripts', selectedScript: null }));
      addMessage('assistant', "Generating new script variations... 🎬");

      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!scriptOptions || scriptOptions.length === 0) {
        throw new Error('Failed to generate script variations');
      }

      setState(prev => ({ ...prev, isRegenerating: null }));

      const scriptQuestion: InlineQuestion = {
        id: 'script-selection',
        question: 'Here are fresh script options:',
        options: scriptOptions.map(s => ({ id: s.id, label: s.name, description: s.description }))
      };

      await simulateTyping(
        "I've generated new script variations! Choose the one that best fits your brand:",
        { inlineQuestion: scriptQuestion, stepId: 'script-selection' },
        500
      );
      toast.success('Scripts regenerated', { description: 'New script options available' });
    } catch (error) {
      handleError(error, 'Regenerating scripts');
    }
  }, [addMessage, simulateTyping, handleError]);

  const regenerateCreatives = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRegenerating: 'creatives', selectedCreative: null, step: 'creative-generation' }));
      addMessage('assistant', "Regenerating ad creatives with new AI variations... 🎨");

      await new Promise(resolve => setTimeout(resolve, 3000));

      if (!mockCreatives || mockCreatives.length === 0) {
        throw new Error('Failed to generate creative variations');
      }

      setState(prev => ({ ...prev, creatives: mockCreatives, isRegenerating: null }));

      const creativeQuestion: InlineQuestion = {
        id: 'creative-selection',
        question: 'Here are your new creative options:',
        options: mockCreatives.map(c => ({
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
      setState(prev => ({ ...prev, step: 'creative-review' }));
      toast.success('Creatives regenerated', { description: 'New creative options available' });
    } catch (error) {
      handleError(error, 'Regenerating creatives');
    }
  }, [addMessage, simulateTyping, handleError]);

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

      const avatarQuestion: InlineQuestion = {
        id: 'avatar-selection',
        question: 'Select an AI presenter for your video:',
        options: avatarOptions.map(a => ({ id: a.id, label: a.name, description: a.style }))
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
        ...mockCreatives.map(c => ({
          id: c.id,
          label: c.name,
          description: c.type === 'video' ? 'Video format' : 'Image format'
        })),
        { id: 'custom-creative', label: '📤 Upload My Own', description: 'Use your own image or video' }
      ]
    };

    addMessage('assistant', "No problem! Here are the AI-generated creative options:", { inlineQuestion: creativeQuestion, stepId: 'creative-review' });
  }, [addMessage]);



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
    generatedAvatars,
  };
};
