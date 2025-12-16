import { memo } from 'react';
import { 
  Play,
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal
} from 'lucide-react';
export interface AdPreviewProps {
  creative: { thumbnail: string; type: string; name: string } | null;
  title: string;
  headline: string;
  cta: string;
}

export const MobilePreview = memo(({ creative, title, headline, cta }: AdPreviewProps) => {
  if (!creative) return null;
  
  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden shadow-md">
      {/* Header */}
      <div className="p-2 flex items-center gap-2 border-b border-border/50">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70" />
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-foreground">Your Business</p>
          <p className="text-[8px] text-muted-foreground">Sponsored</p>
        </div>
        <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
      </div>

      {/* Text */}
      <div className="px-2 py-1.5">
        <p className="text-[10px] text-foreground line-clamp-2">{headline}...</p>
      </div>

      {/* Creative */}
      <div className="relative aspect-square">
        <img 
          src={creative.thumbnail} 
          alt="Ad" 
          className="w-full h-full object-cover"
        />
        {creative.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-3 h-3 text-foreground ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="p-2 bg-muted/30 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-[8px] text-muted-foreground uppercase">yourstore.com</p>
            <p className="text-[10px] font-semibold text-foreground truncate">{title}</p>
          </div>
          <button className="px-2.5 py-1 bg-primary text-primary-foreground text-[9px] font-semibold rounded flex-shrink-0">
            {cta}
          </button>
        </div>
      </div>

      {/* Engagement */}
      <div className="px-2 py-1 flex items-center justify-between border-t border-border/50">
        <div className="flex items-center gap-1">
          <ThumbsUp className="w-2 h-2 text-[#1877F2]" fill="#1877F2" />
          <span className="text-[8px] text-muted-foreground">142</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ThumbsUp className="w-3 h-3" />
          <MessageCircle className="w-3 h-3" />
          <Share2 className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
});

MobilePreview.displayName = 'MobilePreview';

export const DesktopPreview = memo(({ creative, title, headline, cta }: AdPreviewProps) => {
  if (!creative) return null;
  
  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden shadow-md">
      {/* Header */}
      <div className="p-2.5 flex items-center gap-2 border-b border-border/50">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70" />
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-foreground">Your Business</p>
          <p className="text-[9px] text-muted-foreground">Sponsored · 🌐</p>
        </div>
        <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
      </div>

      {/* Text */}
      <div className="px-2.5 py-1.5">
        <p className="text-[11px] text-foreground line-clamp-2">{headline}</p>
      </div>

      {/* Creative */}
      <div className="relative aspect-video">
        <img 
          src={creative.thumbnail} 
          alt="Ad" 
          className="w-full h-full object-cover"
        />
        {creative.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-4 h-4 text-foreground ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="p-2.5 bg-muted/30 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-[9px] text-muted-foreground uppercase">yourstore.com</p>
            <p className="text-[11px] font-semibold text-foreground truncate">{title}</p>
          </div>
          <button className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded flex-shrink-0">
            {cta}
          </button>
        </div>
      </div>

      {/* Engagement */}
      <div className="px-2.5 py-1.5 flex items-center justify-between border-t border-border/50">
        <div className="flex items-center gap-1">
          <ThumbsUp className="w-2.5 h-2.5 text-[#1877F2]" fill="#1877F2" />
          <span className="text-[9px] text-muted-foreground">1.2K</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <ThumbsUp className="w-3.5 h-3.5" />
          <MessageCircle className="w-3.5 h-3.5" />
          <Share2 className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
});

DesktopPreview.displayName = 'DesktopPreview';
