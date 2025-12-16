import { CampaignConfig, CreativeOption, AdAccount } from '@/types/campaign';
import { Settings, Target, DollarSign, MousePointer, Calendar, Facebook, Check, Play, Loader2, FileText, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignConfigPanelProps {
  selectedCreative: CreativeOption | null;
  campaignConfig: CampaignConfig | null;
  facebookConnected: boolean;
  selectedAdAccount: AdAccount | null;
}

export const CampaignConfigPanel = ({ 
  selectedCreative, 
  campaignConfig,
  facebookConnected,
  selectedAdAccount 
}: CampaignConfigPanelProps) => {
  const configItems = [
    { 
      label: 'Objective', 
      value: campaignConfig?.objective, 
      icon: Target,
      category: 'campaign'
    },
    { 
      label: 'Budget Type', 
      value: campaignConfig?.budgetType === 'daily' ? 'Daily' : campaignConfig?.budgetType === 'lifetime' ? 'Lifetime' : undefined, 
      icon: Layers,
      category: 'campaign'
    },
    { 
      label: 'Budget Amount', 
      value: campaignConfig?.budgetAmount ? `$${campaignConfig.budgetAmount}/${campaignConfig.budgetType === 'daily' ? 'day' : 'total'}` : undefined, 
      icon: DollarSign,
      category: 'adset'
    },
    { 
      label: 'Call-to-Action', 
      value: campaignConfig?.cta, 
      icon: MousePointer,
      category: 'ad'
    },
    { 
      label: 'Duration', 
      value: campaignConfig?.duration === 'ongoing' ? 'Ongoing' : campaignConfig?.duration ? `${campaignConfig.duration} days` : undefined, 
      icon: Calendar,
      category: 'adset'
    },
  ];

  const completedCount = configItems.filter(item => item.value).length + (facebookConnected ? 1 : 0);
  const totalItems = configItems.length + 1;

  const getBudgetValue = () => {
    if (!campaignConfig?.budgetAmount) return 0;
    return parseFloat(campaignConfig.budgetAmount);
  };

  const getDurationValue = () => {
    if (!campaignConfig?.duration || campaignConfig.duration === 'ongoing') return 0;
    return parseInt(campaignConfig.duration);
  };

  const totalBudget = getBudgetValue() * (getDurationValue() || 1);

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Campaign Setup</h2>
          <p className="text-[10px] text-muted-foreground">Configure your campaign settings</p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {completedCount}/{totalItems}
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left - Creative Preview */}
        <div className="space-y-3">
          {selectedCreative ? (
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              <div className="relative aspect-square">
                <img 
                  src={selectedCreative.thumbnail} 
                  alt={selectedCreative.name}
                  className="w-full h-full object-cover"
                />
                {selectedCreative.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-4 h-4 text-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-2.5 flex items-center gap-2 bg-muted/30 border-t border-border/50">
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-medium text-foreground truncate">{selectedCreative.name}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 aspect-square flex items-center justify-center bg-muted/30">
              <p className="text-xs text-muted-foreground">No creative selected</p>
            </div>
          )}

          {/* Quick Stats */}
          {campaignConfig?.budgetAmount && campaignConfig?.duration && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Estimated Total</span>
                <span className="text-sm font-bold text-primary">
                  {campaignConfig.duration === 'ongoing' 
                    ? `$${campaignConfig.budgetAmount}/day` 
                    : `$${totalBudget.toLocaleString()}`
                  }
                </span>
              </div>
              {campaignConfig.duration !== 'ongoing' && (
                <p className="text-[9px] text-muted-foreground mt-1">
                  {campaignConfig.duration} days at ${campaignConfig.budgetAmount}/{campaignConfig.budgetType === 'daily' ? 'day' : 'total'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right - Config Items */}
        <div className="space-y-3">
          {/* Campaign Settings */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b border-border/50">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Settings</p>
            </div>
            <div className="p-2 space-y-1.5">
              {configItems.map((item) => (
                <ConfigItem 
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </div>

          {/* Facebook Connection */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b border-border/50">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Platform</p>
            </div>
            <div className="p-2">
              <div className={cn(
                "flex items-center gap-2.5 p-2 rounded-lg transition-colors",
                facebookConnected 
                  ? "bg-[#1877F2]/5 border border-[#1877F2]/20" 
                  : "bg-muted/30 border border-dashed border-border/50"
              )}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                  facebookConnected ? "bg-[#1877F2]" : "bg-muted"
                )}>
                  <Facebook className={cn(
                    "w-3.5 h-3.5",
                    facebookConnected ? "text-white" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-[11px] font-medium truncate",
                    facebookConnected ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {facebookConnected 
                      ? selectedAdAccount?.name || 'Connected' 
                      : 'Facebook Ads'}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {facebookConnected 
                      ? selectedAdAccount?.status || 'Ready to publish'
                      : 'Waiting for connection...'}
                  </p>
                </div>
                {facebookConnected ? (
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ConfigItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
}

const ConfigItem = ({ icon: Icon, label, value }: ConfigItemProps) => (
  <div className={cn(
    "flex items-center gap-2 p-2 rounded-md transition-colors",
    value ? "bg-muted/30" : "bg-transparent border border-dashed border-border/50"
  )}>
    <div className={cn(
      "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
      value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
    )}>
      <Icon className="w-3 h-3" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={cn(
        "text-[11px] font-medium truncate",
        value ? "text-foreground" : "text-muted-foreground"
      )}>
        {value || 'Pending...'}
      </p>
    </div>
    {value && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
  </div>
);
