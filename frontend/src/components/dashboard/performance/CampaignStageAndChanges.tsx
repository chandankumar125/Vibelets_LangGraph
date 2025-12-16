import { PublishedCampaign, PerformanceChange, CampaignLifecycleStage } from '@/types/campaign';
import { FlaskConical, Settings, Rocket, TrendingUp, AlertTriangle, ArrowRight, CheckCircle, Inbox } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface CampaignStageAndChangesProps {
  selectedCampaign: PublishedCampaign | null;
}

const stages: { id: CampaignLifecycleStage; label: string; icon: typeof FlaskConical }[] = [
  { id: 'testing', label: 'Testing', icon: FlaskConical },
  { id: 'optimizing', label: 'Optimizing', icon: Settings },
  { id: 'scaling', label: 'Scaling', icon: Rocket }
];

const categoryConfig = {
  good: {
    icon: TrendingUp,
    label: 'Good News',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10'
  },
  attention: {
    icon: AlertTriangle,
    label: 'Needs Attention',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10'
  },
  steady: {
    icon: ArrowRight,
    label: 'Steady',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50'
  },
  'action-taken': {
    icon: CheckCircle,
    label: 'Action Taken',
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  }
};

// Empty state when no campaign is selected
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
      <Inbox className="h-6 w-6 text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-muted-foreground">Select a campaign</p>
    <p className="text-xs text-muted-foreground/70 mt-1">Use the filter above to view campaign details</p>
  </div>
);

// Lifecycle Meter Component
const LifecycleMeter = ({ stage, progress, description }: { stage: CampaignLifecycleStage; progress: number; description: string }) => {
  const currentIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className="glass-card p-4 rounded-xl flex-1">
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Campaign Stage</h4>
      
      {/* Stage pills */}
      <div className="flex items-center justify-between mb-3">
        {stages.map((s, index) => {
          const Icon = s.icon;
          const isActive = s.id === stage;
          const isPast = index < currentIndex;

          return (
            <div key={s.id} className="flex flex-col items-center flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                isActive && "bg-primary shadow-md",
                isPast && "bg-secondary",
                !isActive && !isPast && "bg-muted"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  isActive && "text-primary-foreground",
                  isPast && "text-secondary-foreground",
                  !isActive && !isPast && "text-muted-foreground"
                )} />
              </div>
              <span className={cn(
                "text-[10px] mt-1.5 font-medium",
                isActive && "text-primary",
                isPast && "text-secondary",
                !isActive && !isPast && "text-muted-foreground"
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar - flat colors, no gradient */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
        <div 
          className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {description}
      </p>
    </div>
  );
};

// What Changed Widget Component
const WhatChangedSection = ({ changes }: { changes: PerformanceChange[] }) => {
  const groupedChanges = [
    { category: 'good' as const, changes: changes.filter(c => c.category === 'good') },
    { category: 'attention' as const, changes: changes.filter(c => c.category === 'attention') },
    { category: 'steady' as const, changes: changes.filter(c => c.category === 'steady') },
    { category: 'action-taken' as const, changes: changes.filter(c => c.category === 'action-taken') }
  ].filter(g => g.changes.length > 0);

  if (changes.length === 0) {
    return (
      <div className="glass-card p-4 rounded-xl flex-1">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">What Changed</h4>
        <p className="text-xs text-muted-foreground text-center py-4">No recent changes</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl flex-1 overflow-hidden">
      <Accordion type="single" collapsible defaultValue="changes" className="w-full">
        <AccordionItem value="changes" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50">
            <div className="flex items-center gap-2 text-left">
              <span className="text-sm font-medium text-muted-foreground">What Changed</span>
              <span className="text-xs text-muted-foreground/70">
                ({changes.length})
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {groupedChanges.map((group) => {
                const config = categoryConfig[group.category];
                const Icon = config.icon;

                return (
                  <div key={group.category} className="space-y-1.5">
                    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px]", config.bgColor)}>
                      <Icon className={cn("h-3 w-3", config.color)} />
                      <span className={cn("font-medium", config.color)}>{config.label}</span>
                    </div>
                    {group.changes.map((change, index) => (
                      <div 
                        key={change.id}
                        className="pl-4 animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <p className="text-xs font-medium text-foreground">{change.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{change.description}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export const CampaignStageAndChanges = ({ selectedCampaign }: CampaignStageAndChangesProps) => {
  if (!selectedCampaign) {
    return (
      <div className="glass-card rounded-xl p-4">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <LifecycleMeter 
        stage={selectedCampaign.lifecycleStage}
        progress={selectedCampaign.stageProgress}
        description={selectedCampaign.stageDescription}
      />
      <WhatChangedSection changes={selectedCampaign.changes} />
    </div>
  );
};
