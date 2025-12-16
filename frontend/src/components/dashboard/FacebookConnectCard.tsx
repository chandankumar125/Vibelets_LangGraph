import { cn } from '@/lib/utils';
import { Check, ExternalLink } from 'lucide-react';

interface FacebookConnectCardProps {
  onConnect: () => void;
  isConnected?: boolean;
  disabled?: boolean;
}

export const FacebookConnectCard = ({ onConnect, isConnected, disabled }: FacebookConnectCardProps) => {
  if (isConnected) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 animate-fade-in">
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

  return (
    <div className="mt-4 animate-fade-in">
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
    </div>
  );
};
