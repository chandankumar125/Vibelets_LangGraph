import { CampaignState, CampaignStep, ScriptOption, CreativeOption, AIRecommendation } from '@/types/campaign';
import { WelcomePanel } from './panels/WelcomePanel';
import { ProductAnalysisPanel } from './panels/ProductAnalysisPanel';
import { ScriptPreviewPanel } from './panels/ScriptPreviewPanel';
import { AvatarPreviewPanel } from './panels/AvatarPreviewPanel';
import { CreativeGenerationPanel } from './panels/CreativeGenerationPanel';
import { CreativeGalleryPanel } from './panels/CreativeGalleryPanel';
import { CampaignConfigPanel } from './panels/CampaignConfigPanel';
import CampaignSummaryPanel from './panels/CampaignSummaryPanel';
import { PublishingPanel } from './panels/PublishingPanel';
import { PerformanceDashboardPanel } from './panels/PerformanceDashboardPanel';
import { CustomScriptInput } from './panels/CustomScriptInput';
import { CustomCreativeUpload } from './panels/CustomCreativeUpload';
import { StepIndicator } from './StepIndicator';
import { StepLoadingAnimation } from './StepLoadingAnimation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { scriptOptions, avatarOptions } from '@/data/mockData';
import { useEffect, useRef } from 'react';

interface RightPanelProps {
  state: CampaignState;
  onReset: () => void;
  onStepClick: (step: CampaignStep) => void;
  onRegenerateProduct?: () => void;
  onRegenerateScripts?: () => void;
  onRegenerateCreatives?: () => void;
  onCustomScriptSubmit?: (script: ScriptOption) => void;
  onCustomScriptCancel?: () => void;
  onCustomCreativeSubmit?: (creative: CreativeOption) => void;
  onCustomCreativeCancel?: () => void;
  onCampaignFilterChange?: (campaignId: string | null) => void;
  onOpenActionCenter?: () => void;
  onCloseActionCenter?: () => void;
  onRecommendationAction?: (recommendationId: string, action: string, value?: number) => void;
  onRefreshDashboard?: () => void;
  onCloneCreative?: (recommendation: AIRecommendation) => void;
}

export const RightPanel = ({
  state,
  onReset,
  onStepClick,
  onRegenerateProduct,
  onRegenerateScripts,
  onRegenerateCreatives,
  onCustomScriptSubmit,
  onCustomScriptCancel,
  onCustomCreativeSubmit,
  onCustomCreativeCancel,
  onCampaignFilterChange,
  onOpenActionCenter,
  onCloseActionCenter,
  onRecommendationAction,
  onRefreshDashboard,
  onCloneCreative,
}: RightPanelProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scriptSectionRef = useRef<HTMLDivElement>(null);
  const avatarSectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the relevant section when step changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!viewportRef.current) return;

      // Scroll to specific section based on current step
      if (state.step === 'script-selection' && scriptSectionRef.current) {
        scriptSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (state.step === 'avatar-selection' && avatarSectionRef.current) {
        avatarSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // For other steps, scroll to top
        viewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [state.step]);

  const renderPanel = () => {
    // Show loading animation when transitioning between steps
    if (state.isStepLoading) {
      return <StepLoadingAnimation step={state.step} />;
    }

    switch (state.step) {
      case 'welcome':
      case 'product-url':
        return <WelcomePanel />;
      
      case 'product-analysis':
        return (
          <ProductAnalysisPanel 
            productData={state.productData} 
            productUrl={state.productUrl} 
            isAnalyzing={!state.productData}
            isRegenerating={state.isRegenerating === 'product'}
            onRegenerate={onRegenerateProduct}
          />
        );
      
      case 'script-selection':
        return (
          <>
            <ProductAnalysisPanel productData={state.productData} productUrl={state.productUrl} isAnalyzing={false} />
            <div ref={scriptSectionRef}>
              {state.isCustomScriptMode && onCustomScriptSubmit && onCustomScriptCancel ? (
                <CustomScriptInput 
                  onSubmit={(script) => onCustomScriptSubmit({
                    id: 'custom-script',
                    name: 'Custom Script',
                    description: script.headline,
                    duration: 'Custom',
                    style: 'User Created',
                    isCustom: true,
                    customContent: script
                  })}
                  onCancel={onCustomScriptCancel}
                />
              ) : (
                <ScriptPreviewPanel 
                  scripts={scriptOptions} 
                  selectedScript={state.selectedScript}
                  isRegenerating={state.isRegenerating === 'scripts'}
                  onRegenerate={onRegenerateScripts}
                />
              )}
            </div>
          </>
        );
      
      case 'avatar-selection':
        return (
          <>
            <ProductAnalysisPanel productData={state.productData} productUrl={state.productUrl} isAnalyzing={false} />
            <ScriptPreviewPanel scripts={scriptOptions} selectedScript={state.selectedScript} />
            <div ref={avatarSectionRef}>
              <AvatarPreviewPanel avatars={avatarOptions} selectedAvatar={state.selectedAvatar} />
            </div>
          </>
        );
      
      case 'creative-generation':
        return <CreativeGenerationPanel />;
      
      case 'creative-review':
        return state.isCustomCreativeMode && onCustomCreativeSubmit && onCustomCreativeCancel ? (
          <CustomCreativeUpload 
            onSubmit={(creative) => onCustomCreativeSubmit({
              id: 'custom-creative',
              type: creative.type,
              thumbnail: creative.preview,
              name: creative.name,
              isCustom: true,
              file: creative.file
            })}
            onCancel={onCustomCreativeCancel}
          />
        ) : (
          <CreativeGalleryPanel 
            creatives={state.creatives} 
            selectedCreative={state.selectedCreative}
            isRegenerating={state.isRegenerating === 'creatives'}
            onRegenerate={onRegenerateCreatives}
          />
        );
      
      case 'campaign-setup':
      case 'facebook-integration':
      case 'ad-account-selection':
        return (
          <CampaignConfigPanel 
            selectedCreative={state.selectedCreative}
            campaignConfig={state.campaignConfig}
            facebookConnected={state.facebookConnected}
            selectedAdAccount={state.selectedAdAccount}
          />
        );
      
      case 'campaign-preview':
        return <CampaignSummaryPanel state={state} />;
      
      case 'publishing':
        return <PublishingPanel isPublished={false} onCreateAnother={onReset} />;
      
      case 'published':
        if (state.performanceDashboard && onCampaignFilterChange && onOpenActionCenter && onCloseActionCenter && onRecommendationAction) {
          return (
            <PerformanceDashboardPanel
              dashboard={state.performanceDashboard}
              isRefreshing={state.isRefreshingDashboard}
              onCampaignFilterChange={onCampaignFilterChange}
              onOpenActionCenter={onOpenActionCenter}
              onCloseActionCenter={onCloseActionCenter}
              onRecommendationAction={onRecommendationAction}
              onCreateAnother={onReset}
              onRefresh={onRefreshDashboard}
              onCloneCreative={onCloneCreative}
            />
          );
        }
        return <PublishingPanel isPublished={true} onCreateAnother={onReset} />;
      
      default:
        return <WelcomePanel />;
    }
  };

  // Hide step indicator when published - show clean performance view
  const showStepIndicator = state.step !== 'welcome' && state.step !== 'product-url' && state.step !== 'published';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showStepIndicator && (
        <div className="flex-shrink-0 bg-background/30 border-b border-border/50 animate-fade-in">
          <StepIndicator currentStep={state.step} onStepClick={onStepClick} />
        </div>
      )}
      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div key={state.step} className="animate-fade-in">
          {renderPanel()}
        </div>
      </ScrollArea>
    </div>
  );
};
