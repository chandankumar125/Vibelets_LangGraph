import { useState, useCallback, useMemo } from 'react';
import { CampaignState, CampaignStep, Message, ProductData, ScriptOption, AvatarOption, CreativeOption, CampaignConfig, AdAccount, InlineQuestion, AIRecommendation, ProductInsight } from '@/types/campaign';
import { mockCreatives, avatarOptions, mockAdAccounts, campaignObjectives, ctaOptions, scriptOptions, mockProductData } from '@/data/mockData';
import { createMockPerformanceDashboard } from '@/data/mockPerformanceData';
import { toast } from 'sonner';
import { isValidUrl, sanitizeInput, validateCampaignConfig, formatErrorMessage } from '@/lib/validation';
import { matchUserInputToOption, looksLikeUrl } from '@/lib/nlpMatcher';
import { vibeletsAPI } from '@/lib/api';

const STEP_ORDER: CampaignStep[] = [
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

export const useCampaignFlow = () => {
  const [state, setState] = useState<CampaignState>(initialState);
  const [messages, setMessages] = useState<Message[]>([
    createMessage('assistant', "Hey! 👋 I'm your Vibelets AI assistant. I'll help you create a high-converting ad campaign in minutes.\n\nJust paste your product URL below to get started.", { stepId: 'welcome' })
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [generatedScripts, setGeneratedScripts] = useState<ScriptOption[]>([]);
  const [generatedAvatars, setGeneratedAvatars] = useState<AvatarOption[]>([]);

  // Find the active question that can receive natural language input
  const activeQuestion: InlineQuestion | null = useMemo(() => {
    const chipQuestionIds = ['product-continue', 'script-selection', 'avatar-selection', 'creative-selection', 'ad-account-selection', 'publish-confirm'];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.inlineQuestion && chipQuestionIds.includes(msg.inlineQuestion.id)) {
        if (!selectedAnswers[msg.inlineQuestion.id]) {
          return msg.inlineQuestion;
        }
      }
    }
    return null;
  }, [messages, selectedAnswers]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, options?: { inlineQuestion?: InlineQuestion; stepId?: CampaignStep; showCampaignSlider?: boolean; showFacebookConnect?: boolean }) => {
    setMessages(prev => [...prev, createMessage(role, content, options)]);
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

  const goToStep = useCallback((targetStep: CampaignStep) => {
    const targetIndex = STEP_ORDER.indexOf(targetStep);
    const currentIndex = STEP_ORDER.indexOf(state.step);

    if (targetIndex < currentIndex) {
      setState(prev => {
        const newState = { ...prev, step: targetStep };

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

  const handleUserMessage = useCallback(async (content: string) => {
    try {
      const sanitizedContent = sanitizeInput(content);
      if (!sanitizedContent) {
        toast.error('Invalid input', { description: 'Please enter a valid message' });
        return;
      }

      // Try natural language matching first (before adding message to chat)
      // Skip if it looks like a URL
      if (!looksLikeUrl(sanitizedContent) && activeQuestion) {
        const matchResult = matchUserInputToOption(sanitizedContent, activeQuestion);

        if (matchResult.matched && matchResult.optionId) {
          // Found a match - handle it as a question answer
          // Add a friendly user message based on what they typed
          addMessage('user', sanitizedContent);

          // Process the selection
          await handleQuestionAnswerInternal(activeQuestion.id, matchResult.optionId, true);
          return;
        }
      }

      addMessage('user', sanitizedContent);


      if (state.step === 'welcome' || state.step === 'product-url') {
        // Check if it looks like a URL
        if (sanitizedContent.includes('.') || sanitizedContent.includes('http')) {
          // Validate URL format
          if (!isValidUrl(sanitizedContent)) {
            await simulateTyping("That doesn't look like a valid URL. Please provide a complete product URL (e.g., https://yourstore.com/product).");
            return;
          }

          setState(prev => ({ ...prev, step: 'product-analysis', productUrl: sanitizedContent, stepHistory: [...prev.stepHistory, 'product-analysis'], isStepLoading: true }));

          await simulateTyping("Perfect! Analyzing your product page now... 🔍", { stepId: 'product-analysis' }, 1000);

          try {
            // ✅ REAL API CALL - Scrape product
            const scrapeResult = await vibeletsAPI.scrapeProduct(sanitizedContent);

            if (scrapeResult.error) {
              throw new Error(scrapeResult.error);
            }

            const scrapedProduct = scrapeResult.product_data;

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

            const continueQuestion: InlineQuestion = {
              id: 'product-continue',
              question: 'Ready to create your ad?',
              options: [
                { id: 'continue', label: 'Continue', description: 'Proceed to script selection' },
                { id: 'change', label: 'Change URL', description: 'Use a different product' }
              ]
            };

            await simulateTyping(
              `I've analyzed your product page and found some great insights!\n\n**${productData.title}** looks perfect for video ads. I've identified ${productData.images.length} high-quality images and extracted key product details.\n\nCheck the preview panel for full details. Ready to proceed?`,
              { inlineQuestion: continueQuestion, stepId: 'product-analysis' },
              1500
            );
          } catch (error) {
            console.error('Product scraping/analysis error:', error);
            setState(prev => ({ ...prev, isStepLoading: false }));
            throw error;
          }
        } else {
          // Check if there's an active question they might be answering
          if (activeQuestion) {
            await simulateTyping(`I didn't quite catch that. You can type something like "the first one", "Script A", or click a suggestion below.`, {}, 800);
          } else {
            await simulateTyping("Please share your product URL (e.g., https://yourstore.com/product) and I'll analyze it for you.");
          }
        }
      } else if (activeQuestion) {
        // There's an active question but we couldn't match - provide helpful guidance
        await simulateTyping(`I didn't quite understand. Try typing the option name (like "${activeQuestion.options[0]?.label}") or use the suggestions below.`, {}, 800);
      }
    } catch (error) {
      handleError(error, 'Processing your message');
    }
  }, [state.step, activeQuestion, addMessage, simulateTyping, handleError]);

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
      setState(prev => ({ ...prev, facebookConnected: true, isStepLoading: true }));

      // Simulate OAuth popup return
      await simulateTyping("Redirecting to Facebook...", {}, 500);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check for ad accounts
      if (!mockAdAccounts || mockAdAccounts.length === 0) {
        throw new Error('No ad accounts found. Please ensure you have at least one Facebook Ad Account.');
      }

      const accountQuestion: InlineQuestion = {
        id: 'ad-account-selection',
        question: 'Which ad account should we use?',
        options: mockAdAccounts.map(a => ({ id: a.id, label: a.name, description: `Status: ${a.status}` }))
      };

      await simulateTyping(
        `Facebook connected! 🔗\n\nI found ${mockAdAccounts.length} ad accounts. Select one to continue:`,
        { inlineQuestion: accountQuestion, stepId: 'ad-account-selection' },
        800
      );
      setState(prev => ({ ...prev, step: 'ad-account-selection', stepHistory: [...prev.stepHistory, 'ad-account-selection'], isStepLoading: false }));
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

  // Internal handler that can skip adding user message (for NLP-matched inputs)
  const handleQuestionAnswerInternal = useCallback(async (questionId: string, answerId: string, skipUserMessage = false) => {
    try {
      if (!questionId || !answerId) {
        toast.error('Invalid selection', { description: 'Please try again' });
        return;
      }

      // Track the answer
      setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));

      if (questionId === 'product-continue') {
        if (answerId === 'continue') {
          if (!skipUserMessage) addMessage('user', "Let's continue!");
          setState(prev => ({ ...prev, isStepLoading: true }));

          try {
            // ✅ REAL API CALL - Generate Scripts
            const scriptsResult = await vibeletsAPI.generateScripts();

            if (scriptsResult.error) {
              throw new Error(scriptsResult.error);
            }

            // Convert backend response to frontend ScriptOption format
            const backendScripts = scriptsResult.scripts || [];
            const formattedScripts: ScriptOption[] = backendScripts.map((script: any, index: number) => ({
              id: `script-${index}`,
              name: script.name || `Script ${index + 1}`,
              description: script.description || script.hook?.substring(0, 50) + '...' || '',
              hook: script.hook || '',
              body: script.body || '',
              cta: script.cta || 'Shop Now',
              tone: script.tone || 'Professional'
            }));

            setGeneratedScripts(formattedScripts);

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
            // ✅ REAL API CALL - Get Avatars
            const avatarsResult = await vibeletsAPI.getAvatars();

            if (avatarsResult.error) {
              throw new Error(avatarsResult.error);
            }

            // Convert backend response to AvatarOption format
            const backendAvatars = avatarsResult.avatars || [];
            const formattedAvatars: AvatarOption[] = backendAvatars.map((avatar: any) => ({
              id: avatar.avatar_id || avatar.id,
              name: avatar.avatar_name || avatar.name || 'Avatar',
              style: avatar.preview_video_url ? 'Professional' : 'Casual',
              image: avatar.preview_image_url || avatar.thumbnail || '',
              thumbnail: avatar.preview_image_url || avatar.thumbnail || '',
              previewVideo: avatar.preview_video_url || undefined
            }));

            setGeneratedAvatars(formattedAvatars);

            // Fallback to mock avatars if backend returns empty
            const avatarsToUse = formattedAvatars.length > 0 ? formattedAvatars : avatarOptions;

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
          } catch (error) {
            console.error('Avatar fetching error:', error);
            setState(prev => ({ ...prev, isStepLoading: false }));
            throw error;
          }
        }
      } else if (questionId === 'avatar-selection') {
        const avatar = avatarOptions.find(a => a.id === answerId);
        if (!avatar) {
          toast.error('Avatar not found', { description: 'Please select a valid avatar' });
          return;
        }

        setState(prev => ({ ...prev, selectedAvatar: avatar, isStepLoading: true }));
        if (!skipUserMessage) addMessage('user', `${avatar.name} will be the presenter.`);

        await simulateTyping(
          `${avatar.name} is perfect! 🎥 Now generating your ad creatives...\n\nThis usually takes about 30 seconds.`,
          { stepId: 'creative-generation' },
          1000
        );
        setState(prev => ({ ...prev, step: 'creative-generation', stepHistory: [...prev.stepHistory, 'creative-generation'], isStepLoading: false }));

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check for creatives
        if (!mockCreatives || mockCreatives.length === 0) {
          throw new Error('Failed to generate creatives. Please try again.');
        }

        setState(prev => ({ ...prev, creatives: mockCreatives, isStepLoading: true }));

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

        await simulateTyping(
          `Done! I've generated ${mockCreatives.length} creative variations:\n• 2 Video ads (15s and 30s)\n• 2 Image ads (Static and Carousel)\n\nWhich one would you like to use?`,
          { inlineQuestion: creativeQuestion, stepId: 'creative-review' },
          1500
        );
        setState(prev => ({ ...prev, step: 'creative-review', stepHistory: [...prev.stepHistory, 'creative-review'], isStepLoading: false }));
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
          const creative = mockCreatives.find(c => c.id === answerId);
          if (!creative) {
            toast.error('Creative not found', { description: 'Please select a valid creative' });
            return;
          }

          setState(prev => ({ ...prev, selectedCreative: creative, isStepLoading: true, isCustomCreativeMode: false }));
          if (!skipUserMessage) addMessage('user', `I'll use the "${creative.name}" creative.`);

          await simulateTyping(
            `Excellent choice! Your ${creative.name} is ready. ⏳\n\nLet's quickly configure your campaign:`,
            { showCampaignSlider: true, stepId: 'campaign-setup' },
            1200
          );
          setState(prev => ({ ...prev, step: 'campaign-setup', stepHistory: [...prev.stepHistory, 'campaign-setup'], isStepLoading: false }));
        }
      } else if (questionId === 'ad-account-selection') {
        const account = mockAdAccounts.find(a => a.id === answerId);
        if (!account) {
          toast.error('Ad account not found', { description: 'Please select a valid ad account' });
          return;
        }

        // Check account status
        if (account.status !== 'Active') {
          toast.warning('Account not active', {
            description: `${account.name} is ${account.status}. You may need to activate it in Facebook Business Manager.`
          });
        }

        setState(prev => ({ ...prev, selectedAdAccount: account, isStepLoading: true }));
        if (!skipUserMessage) addMessage('user', `Using "${account.name}" account.`);

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
    } catch (error) {
      handleError(error, 'Processing your selection');
    }
  }, [state.campaignConfig, state.selectedCreative, state.selectedAdAccount, generatedScripts, addMessage, simulateTyping, handleError]);

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

  const resetFlow = useCallback(() => {
    setState(initialState);
    setSelectedAnswers({});
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

    const scriptQuestion: InlineQuestion = {
      id: 'script-selection',
      question: 'Choose a script style that matches your brand voice:',
      options: [
        ...scriptOptions.map(s => ({ id: s.id, label: s.name, description: s.description })),
        { id: 'custom-script', label: '✍️ Write My Own', description: 'Create custom ad copy' }
      ]
    };

    addMessage('assistant', "No problem! Here are the AI-generated script options:", { inlineQuestion: scriptQuestion, stepId: 'script-selection' });
  }, [addMessage]);

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
  };
};
