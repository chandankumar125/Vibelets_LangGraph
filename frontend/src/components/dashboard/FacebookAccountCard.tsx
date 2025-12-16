import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Check, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FacebookAccountCardProps {
  onConnect: () => void;
  onUseExisting: () => void;
  isConnected?: boolean;
  disabled?: boolean;
}

export const FacebookAccountCard = ({ 
  onConnect, 
  onUseExisting,
  isConnected, 
  disabled 
}: FacebookAccountCardProps) => {
  const { user } = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  
  // Check if user logged in via Facebook
  const loggedInViaFacebook = user?.provider === 'facebook' && user?.facebookConnected;

  // If already connected in campaign flow
  if (isConnected) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 animate-scale-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Facebook Connected</p>
            <p className="text-xs text-muted-foreground">Account authorized successfully</p>
          </div>
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // If user logged in via Facebook - show options to use existing or add new
  if (loggedInViaFacebook && !showOptions) {
    return (
      <div className="mt-4 animate-scale-in">
        <div className="p-4 rounded-xl border-2 border-[#1877F2]/30 bg-[#1877F2]/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Facebook Account Available</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
              <Check className="w-4 h-4 text-secondary-foreground" />
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            You signed in with Facebook. Would you like to use this account for your ads?
          </p>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full h-11 rounded-xl"
              onClick={onUseExisting}
              disabled={disabled}
            >
              <Check className="w-4 h-4 mr-2" />
              Use This Account
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={() => setShowOptions(true)}
              disabled={disabled}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Use Different Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default connect button (or after choosing "Use Different Account")
  return (
    <div className="mt-4 animate-scale-in">
      <button
        onClick={onConnect}
        disabled={disabled}
        className={cn(
          "w-full p-4 rounded-xl border-2 border-dashed transition-all duration-200",
          "flex items-center gap-4",
          disabled
            ? "border-border/50 bg-muted/30 cursor-not-allowed"
            : "border-[#1877F2]/30 bg-[#1877F2]/5 hover:border-[#1877F2]/60 hover:bg-[#1877F2]/10 cursor-pointer"
        )}
      >
        {/* Facebook Logo */}
        <div className="w-12 h-12 rounded-xl bg-[#1877F2] flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
        
        <div className="flex-1 text-left">
          <p className="font-medium text-foreground flex items-center gap-2">
            Connect Facebook Ads
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </p>
          <p className="text-xs text-muted-foreground">
            Authorize access to publish campaigns
          </p>
        </div>
      </button>
      
      {showOptions && loggedInViaFacebook && (
        <button
          onClick={() => setShowOptions(false)}
          className="mt-2 text-sm text-primary hover:underline"
        >
          ← Back to use signed-in account
        </button>
      )}
    </div>
  );
};
