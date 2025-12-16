import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoThumbnailPlaceholderProps {
  aspectRatio?: string;
  className?: string;
}

export const VideoThumbnailPlaceholder = ({ aspectRatio, className }: VideoThumbnailPlaceholderProps) => {
  return (
    <div className={cn(
      "w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center relative overflow-hidden",
      className
    )}>
      {/* Animated background waves */}
      <div className="absolute inset-0">
        {/* Wave 1 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-2 border-primary/20 animate-[ping_2s_ease-out_infinite]" />
        </div>
        {/* Wave 2 - delayed */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-2 border-primary/15 animate-[ping_2s_ease-out_infinite_0.5s]" />
        </div>
        {/* Wave 3 - more delayed */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-2 border-primary/10 animate-[ping_2s_ease-out_infinite_1s]" />
        </div>
      </div>

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Film strip accents */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-foreground/5 flex items-center justify-around px-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm bg-foreground/10" />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-foreground/5 flex items-center justify-around px-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm bg-foreground/10" />
        ))}
      </div>

      {/* Center play button with glow */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Play button container */}
        <div className="relative mb-3">
          {/* Glow effect - contained behind button only */}
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-md animate-pulse" />
          
          {/* Play button */}
          <div className="relative w-14 h-14 rounded-full bg-background/90 backdrop-blur-sm border border-border/50 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
            <Play className="w-6 h-6 text-primary ml-0.5" fill="currentColor" />
          </div>
        </div>
        
        {/* Label - completely separate */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border/30">
          <span className="text-xs font-medium text-foreground/80">Video Preview</span>
          {aspectRatio && (
            <span className="text-[10px] text-muted-foreground">• {aspectRatio}</span>
          )}
        </div>
      </div>

      {/* Corner video icon accent */}
      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-background/60 backdrop-blur-sm">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-medium text-foreground/70">VIDEO</span>
      </div>
    </div>
  );
};
