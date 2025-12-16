import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatPanel } from '@/components/dashboard/ChatPanel';
import { RightPanel } from '@/components/dashboard/RightPanel';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useCampaignFlow } from '@/hooks/useCampaignFlow';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [threadTitle, setThreadTitle] = useState('New Campaign');

  const {
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
  } = useCampaignFlow();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (user && !user.hasCompletedOnboarding) {
      navigate('/onboarding');
    }
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Header */}
      <DashboardHeader />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat with glass effect */}
        <div className="w-[35%] max-w-[500px] min-w-[380px] flex-shrink-0 overflow-hidden m-3 mr-0">
          <div className="h-full glass-strong rounded-2xl overflow-hidden shadow-lg">
            <ChatPanel
              messages={messages}
              isTyping={isTyping}
              onSendMessage={handleUserMessage}
              onQuestionAnswer={handleQuestionAnswer}
              onCampaignConfigComplete={handleCampaignConfigComplete}
              onFacebookConnect={handleFacebookConnect}
              onFacebookUseExisting={handleFacebookUseExisting}
              isFacebookConnected={state.facebookConnected}
              threadTitle={threadTitle}
              onThreadTitleChange={setThreadTitle}
              currentStep={state.step}
              selectedAnswers={selectedAnswers}
            />
          </div>
        </div>

        {/* Right Panel - Dynamic Content with glass effect */}
        <div className="flex-1 m-3">
          <div className="h-full glass-card rounded-2xl overflow-hidden shadow-lg">
            <RightPanel
              state={state}
              onReset={resetFlow}
              onStepClick={goToStep}
              onRegenerateProduct={regenerateProductAnalysis}
              onRegenerateScripts={regenerateScripts}
              onRegenerateCreatives={regenerateCreatives}
              onCustomScriptSubmit={handleCustomScriptSubmit}
              onCustomScriptCancel={handleCustomScriptCancel}
              onCustomCreativeSubmit={handleCustomCreativeSubmit}
              onCustomCreativeCancel={handleCustomCreativeCancel}
              onCampaignFilterChange={handleCampaignFilterChange}
              onOpenActionCenter={handleOpenActionCenter}
              onCloseActionCenter={handleCloseActionCenter}
              onRecommendationAction={handleRecommendationAction}
              onRefreshDashboard={refreshPerformanceDashboard}
              onCloneCreative={handleCloneCreative}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;