import { useState, memo } from 'react';
import { CampaignState } from '@/types/campaign';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Target, 
  DollarSign, 
  MousePointer, 
  Clock,
  Facebook,
  Smartphone,
  Monitor,
  Pencil,
  Layers,
  Sparkles,
  Globe,
  BarChart3,
  Image as ImageIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MobilePreview, DesktopPreview } from './AdPreviewComponents';

interface CampaignSummaryPanelProps {
  state: CampaignState;
}

export const CampaignSummaryPanel = ({ state }: CampaignSummaryPanelProps) => {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const { productData, selectedCreative, campaignConfig, selectedAdAccount } = state;

  // Editable fields state
  const [editableFields, setEditableFields] = useState({
    campaignName: campaignConfig?.campaignName || productData?.title || 'My Campaign',
    primaryText: campaignConfig?.primaryText || productData?.description?.slice(0, 125) || 'Check out this amazing product!',
    budgetAmount: campaignConfig?.budgetAmount || '50',
    adSetName: campaignConfig?.adSetName || productData?.title || 'My Campaign',
    adName: campaignConfig?.adName || productData?.title || 'My Campaign',
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  const handleFieldChange = (field: string, value: string) => {
    setEditableFields(prev => ({ ...prev, [field]: value }));
  };

  // Format CTA for display
  const formatCta = (cta: string | undefined) => {
    if (!cta) return 'Shop Now';
    return cta.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Calculate budget display
  const getBudgetDisplay = () => {
    const amount = parseFloat(editableFields.budgetAmount);
    const duration = campaignConfig?.duration === 'ongoing' ? 0 : parseInt(campaignConfig?.duration || '14');
    
    if (campaignConfig?.duration === 'ongoing') {
      return `$${amount}/day`;
    }
    
    const total = amount * duration;
    return `$${total.toLocaleString()}`;
  };

  const EditableField = ({ 
    label, 
    field, 
    value, 
    multiline = false 
  }: { 
    label: string; 
    field: string; 
    value: string; 
    multiline?: boolean;
  }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setEditingField(editingField === field ? null : field)}
              className="transition-colors"
            >
              <Pencil className="w-3 h-3 text-muted-foreground/60 hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Click to edit
          </TooltipContent>
        </Tooltip>
      </div>
      {editingField === field ? (
        multiline ? (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="text-xs min-h-[60px] resize-none"
            autoFocus
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="h-7 text-xs"
            autoFocus
          />
        )
      ) : (
        <p className={cn(
          "text-xs font-medium text-foreground",
          multiline ? "line-clamp-2" : "truncate"
        )}>{value}</p>
      )}
    </div>
  );

  const ReadOnlyField = ({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) => (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
      {Icon && <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-muted-foreground">{label}</p>
        <p className="text-[11px] font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Campaign Preview</h2>
          <p className="text-[10px] text-muted-foreground">Review and edit before publishing</p>
        </div>
      </div>

      {/* Main Layout - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left - Ad Preview */}
        <div className="space-y-3">
          {/* Device Toggle */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setDevice('mobile')}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-colors",
                device === 'mobile' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="w-3 h-3" />
              Mobile
            </button>
            <button
              onClick={() => setDevice('desktop')}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-colors",
                device === 'desktop' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="w-3 h-3" />
              Desktop
            </button>
          </div>

          {/* Ad Preview */}
          {device === 'mobile' ? (
            <MobilePreview 
              creative={selectedCreative}
              title={editableFields.adName}
              headline={editableFields.primaryText}
              cta={formatCta(campaignConfig?.cta)}
            />
          ) : (
            <DesktopPreview 
              creative={selectedCreative}
              title={editableFields.adName}
              headline={editableFields.primaryText}
              cta={formatCta(campaignConfig?.cta)}
            />
          )}
        </div>

        {/* Right - Campaign Configuration */}
        <div className="space-y-3">
          {/* CAMPAIGN LEVEL */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-primary/5 border-b border-border/50 flex items-center gap-2">
              <BarChart3 className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">Campaign Level</p>
            </div>
            <div className="p-3 space-y-3">
              <EditableField 
                label="Campaign Name" 
                field="campaignName" 
                value={editableFields.campaignName} 
              />
              <div className="grid grid-cols-2 gap-2">
                <ReadOnlyField 
                  label="Objective" 
                  value={campaignConfig?.objective || 'Sales'} 
                  icon={Target} 
                />
                <ReadOnlyField 
                  label="Budget Type" 
                  value={campaignConfig?.budgetType === 'lifetime' ? 'Lifetime' : 'Daily'} 
                  icon={DollarSign} 
                />
              </div>
              <ReadOnlyField 
                label="Budget" 
                value={getBudgetDisplay()} 
                icon={DollarSign} 
              />
            </div>
          </div>

          {/* AD SET LEVEL */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-secondary/5 border-b border-border/50 flex items-center gap-2">
              <Layers className="w-3 h-3 text-secondary" />
              <p className="text-[10px] font-semibold text-secondary uppercase tracking-wide">Ad Set Level</p>
            </div>
            <div className="p-3 space-y-3">
              <EditableField 
                label="Ad Set Name" 
                field="adSetName" 
                value={editableFields.adSetName} 
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-md bg-muted/30">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px] text-muted-foreground">Daily Budget</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => setEditingField(editingField === 'budgetAmount' ? null : 'budgetAmount')}
                          className="transition-colors"
                        >
                          <Pencil className="w-2.5 h-2.5 text-muted-foreground/60 hover:text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        Click to edit
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {editingField === 'budgetAmount' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={editableFields.budgetAmount}
                        onChange={(e) => handleFieldChange('budgetAmount', e.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="h-5 text-[11px] p-1 w-16"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] font-medium text-foreground">${editableFields.budgetAmount}/day</p>
                  )}
                </div>
                <ReadOnlyField 
                  label="Duration" 
                  value={campaignConfig?.duration === 'ongoing' ? 'Ongoing' : `${campaignConfig?.duration || '14'} days`} 
                  icon={Clock} 
                />
              </div>
              <ReadOnlyField 
                label="Pixel ID" 
                value={selectedAdAccount ? `px_${selectedAdAccount.id.slice(-6)}` : 'Not connected'} 
                icon={BarChart3} 
              />
            </div>
          </div>

          {/* AD LEVEL */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-muted/50 border-b border-border/50 flex items-center gap-2">
              <ImageIcon className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ad Level</p>
            </div>
            <div className="p-3 space-y-3">
              <EditableField 
                label="Ad Name" 
                field="adName" 
                value={editableFields.adName} 
              />
              <EditableField 
                label="Primary Text" 
                field="primaryText" 
                value={editableFields.primaryText}
                multiline
              />
              <div className="grid grid-cols-2 gap-2">
                <ReadOnlyField 
                  label="CTA Button" 
                  value={formatCta(campaignConfig?.cta)} 
                  icon={MousePointer} 
                />
                <ReadOnlyField 
                  label="Website URL" 
                  value={state.productUrl?.replace(/^https?:\/\//, '').slice(0, 20) + '...' || 'yourstore.com'} 
                  icon={Globe} 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ReadOnlyField 
                  label="Page Name" 
                  value={selectedAdAccount ? selectedAdAccount.name : 'Not connected'} 
                  icon={Facebook} 
                />
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                {selectedCreative?.thumbnail ? (
                    <img 
                      src={selectedCreative.thumbnail} 
                      alt="Creative preview"
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-muted-foreground">Creative</p>
                    <p className="text-[11px] font-medium text-foreground truncate">
                      {selectedCreative?.type === 'video' ? 'Video' : 'Image'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Facebook Account */}
          {selectedAdAccount && (
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1877F2]/5 border border-[#1877F2]/20">
              <div className="w-7 h-7 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                <Facebook className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{selectedAdAccount.name}</p>
                <p className="text-[10px] text-muted-foreground">{selectedAdAccount.status}</p>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            </div>
          )}

          {/* Total Estimate */}
          {campaignConfig && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimated Total</span>
                <span className="text-base font-bold text-primary">
                  {getBudgetDisplay()}
                </span>
              </div>
              {campaignConfig.duration !== 'ongoing' && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {campaignConfig.duration} days at ${editableFields.budgetAmount}/day
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(CampaignSummaryPanel);