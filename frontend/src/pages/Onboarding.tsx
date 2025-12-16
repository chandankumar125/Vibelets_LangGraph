import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Gift, 
  Check, 
  ArrowRight, 
  Coins
} from 'lucide-react';

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, completeOnboarding, claimBonusCredits, isAuthenticated, isLoading } = useAuth();
  const [isClaimingBonus, setIsClaimingBonus] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (user?.hasCompletedOnboarding) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleClaimAndContinue = async () => {
    if (!bonusClaimed) {
      setIsClaimingBonus(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      claimBonusCredits();
      setBonusClaimed(true);
      setIsClaimingBonus(false);
      // Brief pause to show claimed state, then navigate
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    completeOnboarding();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Main content - Single merged screen */}
      <div className="relative z-10 w-full max-w-lg">
        <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-border/50 animate-fade-in">
          {/* Welcome Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full animate-pulse" />
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center relative">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">
            Welcome to Vibelets, {user.name.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mb-6 text-center">
            Your <span className="text-primary font-semibold">Free Forever</span> plan is now active
          </p>

          {/* Plan & Credits Card */}
          <div className="bg-muted/50 rounded-2xl p-5 mb-6 border border-border/50">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/30">
              <div>
                <p className="text-sm text-muted-foreground">Your Plan</p>
                <p className="text-lg font-bold text-foreground">Free Forever</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 border border-secondary/30">
                <Coins className="w-4 h-4 text-secondary" />
                <span className="font-semibold text-secondary">{user.credits}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Daily Credits</p>
                <p className="font-semibold text-foreground">{user.dailyCredits}/day</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rollover Cap</p>
                <p className="font-semibold text-foreground">{user.rolloverCap} credits</p>
              </div>
            </div>
          </div>

          {/* Bonus Claim Card */}
          <div className={cn(
            "rounded-2xl p-5 mb-6 border transition-all duration-500",
            bonusClaimed 
              ? "bg-secondary/10 border-secondary/30" 
              : "bg-primary/5 border-primary/20"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                bonusClaimed ? "bg-secondary/20" : "bg-primary/20"
              )}>
                {bonusClaimed ? (
                  <Check className="w-6 h-6 text-secondary" />
                ) : (
                  <Gift className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {bonusClaimed ? "Bonus Claimed!" : "Welcome Bonus"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {bonusClaimed ? "500 credits added to your account" : "Claim 500 bonus credits to get started"}
                </p>
              </div>
            </div>
          </div>

          {/* What you can do */}
          <div className="space-y-3 mb-8">
            <p className="text-sm font-medium text-muted-foreground">What you can create:</p>
            <div className="flex flex-wrap gap-2">
              {['AI Ad Creatives', 'Video Ads', 'Facebook Campaigns'].map((item) => (
                <div key={item} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm">
                  <Check className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Single CTA */}
          <Button
            size="lg"
            className="w-full h-14 rounded-xl text-lg font-medium group"
            onClick={handleClaimAndContinue}
            disabled={isClaimingBonus}
          >
            {isClaimingBonus ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Claiming Bonus...
              </span>
            ) : bonusClaimed ? (
              <span className="flex items-center gap-2">
                Create First Campaign
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Claim Bonus & Start Creating
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
