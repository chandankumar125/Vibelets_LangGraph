import { PublishedCampaign } from '@/types/campaign';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CampaignFilterProps {
  campaigns: PublishedCampaign[];
  selectedCampaignId: string | null;
  onSelect: (campaignId: string | null) => void;
  showSelectedLabel?: boolean;
  compact?: boolean;
}

const statusColors = {
  active: 'bg-secondary text-secondary-foreground',
  paused: 'bg-muted text-muted-foreground',
  learning: 'bg-primary text-primary-foreground'
};

export const CampaignFilter = ({ campaigns, selectedCampaignId, onSelect, showSelectedLabel, compact }: CampaignFilterProps) => {
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  // Compact mode - just show campaign badge selector
  if (compact) {
    return (
      <Select
        value={selectedCampaignId || 'all'}
        onValueChange={(value) => {
          // Stop event propagation to prevent collapsible from toggling
          onSelect(value === 'all' ? null : value);
        }}
      >
        <SelectTrigger 
          className="h-6 w-auto min-w-[120px] text-xs bg-muted/50 border-none px-2"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border">
          <SelectItem value="all" className="text-xs">
            All ({campaigns.length})
          </SelectItem>
          {campaigns.map((campaign) => (
            <SelectItem key={campaign.id} value={campaign.id} className="text-xs">
              <span className="flex items-center gap-1.5">
                {campaign.name}
                <Badge className={cn("text-[9px] h-3.5 px-1", statusColors[campaign.status])}>
                  {campaign.status}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Select
          value={selectedCampaignId || 'all'}
          onValueChange={(value) => onSelect(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-full h-9 text-sm bg-muted/50">
            <SelectValue placeholder="Select a campaign" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            <SelectItem value="all" className="text-sm">
              <span className="flex items-center gap-2">
                All Campaigns
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {campaigns.length}
                </Badge>
              </span>
            </SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id} className="text-sm">
                <span className="flex items-center gap-2">
                  {campaign.name}
                  <Badge className={cn("text-[10px] h-4 px-1.5", statusColors[campaign.status])}>
                    {campaign.status}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {showSelectedLabel && selectedCampaign && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
          <span>Status:</span>
          <Badge className={cn("text-[10px] h-4 px-1.5", statusColors[selectedCampaign.status])}>
            {selectedCampaign.status}
          </Badge>
        </div>
      )}
    </div>
  );
};
