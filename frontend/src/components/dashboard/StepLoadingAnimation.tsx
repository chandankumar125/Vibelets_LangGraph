import { 
  Globe, 
  FileText, 
  Users, 
  Sparkles, 
  Settings, 
  Facebook, 
  Eye, 
  Rocket,
  Search,
  Wand2,
  Zap,
  Brain
} from 'lucide-react';
import { CampaignStep } from '@/types/campaign';

interface StepLoadingAnimationProps {
  step: CampaignStep;
}

const STEP_LOADING_CONFIG: Record<string, {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  tasks: string[];
}> = {
  'product-analysis': {
    icon: Globe,
    title: 'Analyzing Your Product',
    subtitle: 'Our AI is examining your product page',
    tasks: [
      'Fetching product page...',
      'Extracting product details...',
      'Analyzing pricing & features...',
      'Generating AI insights...'
    ]
  },
  'script-selection': {
    icon: FileText,
    title: 'Crafting Ad Scripts',
    subtitle: 'Generating compelling ad copy for your product',
    tasks: [
      'Analyzing product benefits...',
      'Generating script variations...',
      'Optimizing for engagement...',
      'Finalizing ad copy...'
    ]
  },
  'avatar-selection': {
    icon: Users,
    title: 'Preparing Avatars',
    subtitle: 'Loading AI presenters for your campaign',
    tasks: [
      'Loading avatar library...',
      'Matching presenter styles...',
      'Preparing video previews...',
      'Ready for selection...'
    ]
  },
  'creative-generation': {
    icon: Sparkles,
    title: 'Generating Creatives',
    subtitle: 'Creating stunning visuals for your ads',
    tasks: [
      'Generating video content...',
      'Creating static images...',
      'Applying brand elements...',
      'Rendering final assets...'
    ]
  },
  'creative-review': {
    icon: Eye,
    title: 'Preparing Review',
    subtitle: 'Organizing your creatives for review',
    tasks: [
      'Processing generated assets...',
      'Creating preview thumbnails...',
      'Optimizing for platforms...',
      'Ready for your review...'
    ]
  },
  'campaign-config': {
    icon: Settings,
    title: 'Setting Up Campaign',
    subtitle: 'Configuring your ad campaign parameters',
    tasks: [
      'Loading campaign options...',
      'Analyzing best practices...',
      'Preparing recommendations...',
      'Ready to configure...'
    ]
  },
  'facebook-connect': {
    icon: Facebook,
    title: 'Connecting Facebook',
    subtitle: 'Preparing Facebook Ads integration',
    tasks: [
      'Initializing connection...',
      'Loading ad accounts...',
      'Fetching pixels & pages...',
      'Ready to connect...'
    ]
  },
  'campaign-preview': {
    icon: Eye,
    title: 'Building Preview',
    subtitle: 'Creating your ad preview',
    tasks: [
      'Assembling campaign data...',
      'Generating device previews...',
      'Validating ad content...',
      'Preview ready...'
    ]
  },
  'publishing': {
    icon: Rocket,
    title: 'Publishing Campaign',
    subtitle: 'Launching your ad to Facebook',
    tasks: [
      'Validating campaign...',
      'Uploading creatives...',
      'Configuring targeting...',
      'Going live...'
    ]
  }
};

export const StepLoadingAnimation = ({ step }: StepLoadingAnimationProps) => {
  const config = STEP_LOADING_CONFIG[step] || STEP_LOADING_CONFIG['product-analysis'];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
      {/* Central animated icon */}
      <div className="relative mb-8">
        {/* Outer glow ring */}
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-primary/20 animate-ping" />
        
        {/* Middle pulsing ring */}
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-primary/30 animate-pulse" />
        
        {/* Icon container */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
          <Icon className="w-10 h-10 text-primary-foreground animate-pulse" />
        </div>

        {/* Orbiting elements */}
        <div className="absolute inset-0 w-24 h-24 animate-spin" style={{ animationDuration: '8s' }}>
          <Brain className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-5 text-primary" />
        </div>
        <div className="absolute inset-0 w-24 h-24 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
          <Zap className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 text-secondary" />
        </div>
        <div className="absolute inset-0 w-24 h-24 animate-spin" style={{ animationDuration: '10s' }}>
          <Wand2 className="absolute top-1/2 -right-2 -translate-y-1/2 w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Title and subtitle */}
      <h3 className="text-xl font-semibold text-foreground mb-2 text-center">
        {config.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-8 text-center">
        {config.subtitle}
      </p>

      {/* Animated task list */}
      <div className="w-full max-w-sm space-y-3">
        {config.tasks.map((task, index) => (
          <div 
            key={index}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 animate-fade-in"
            style={{ animationDelay: `${index * 300}ms` }}
          >
            <div className="relative w-5 h-5">
              {index < 3 ? (
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <Search className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className={`text-sm ${index < 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {task}
            </span>
            {index < 2 && (
              <span className="ml-auto text-xs text-primary font-medium">Active</span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom shimmer bar */}
      <div className="w-full max-w-sm mt-8 h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary via-secondary to-primary animate-shimmer bg-[length:200%_100%]" />
      </div>
    </div>
  );
};
