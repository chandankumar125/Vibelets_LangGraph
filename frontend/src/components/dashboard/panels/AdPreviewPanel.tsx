import { useState } from 'react';
import { CampaignState } from '@/types/campaign';
import { cn } from '@/lib/utils';
import { Smartphone, Monitor, Play, Heart, MessageCircle, Share2, ThumbsUp, MoreHorizontal } from 'lucide-react';

interface AdPreviewPanelProps {
  state: CampaignState;
}

export const AdPreviewPanel = ({ state }: AdPreviewPanelProps) => {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const { productData, selectedCreative, campaignConfig } = state;

  if (!selectedCreative) return null;

  return (
    <div className="p-6 space-y-4">
      {/* Device Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Ad Preview</h2>
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setDevice('mobile')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              device === 'mobile' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Smartphone className="w-4 h-4" />
            Mobile
          </button>
          <button
            onClick={() => setDevice('desktop')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              device === 'desktop' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="w-4 h-4" />
            Desktop
          </button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex justify-center">
        {device === 'mobile' ? (
          <MobileAdPreview 
            creative={selectedCreative}
            productData={productData}
            cta={campaignConfig?.cta || 'Shop Now'}
          />
        ) : (
          <DesktopAdPreview 
            creative={selectedCreative}
            productData={productData}
            cta={campaignConfig?.cta || 'Shop Now'}
          />
        )}
      </div>
    </div>
  );
};

interface PreviewProps {
  creative: { thumbnail: string; type: string; name: string };
  productData: { title: string; description: string } | null;
  cta: string;
}

const MobileAdPreview = ({ creative, productData, cta }: PreviewProps) => {
  return (
    <div className="w-[280px] bg-background border border-border rounded-2xl overflow-hidden shadow-lg">
      {/* Facebook Header */}
      <div className="p-3 flex items-center gap-2 border-b border-border/50">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">Your Business</p>
          <p className="text-[10px] text-muted-foreground">Sponsored · 🌐</p>
        </div>
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Post Text */}
      <div className="px-3 py-2">
        <p className="text-xs text-foreground line-clamp-2">
          {productData?.description || 'Check out our amazing product!'}
        </p>
      </div>

      {/* Creative */}
      <div className="relative aspect-square">
        <img 
          src={creative.thumbnail}
          alt="Ad creative"
          className="w-full h-full object-cover"
        />
        {creative.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-foreground ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="p-3 bg-muted/30 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase">yourstore.com</p>
            <p className="text-xs font-semibold text-foreground truncate">
              {productData?.title || 'Amazing Product'}
            </p>
          </div>
          <button className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md flex-shrink-0">
            {cta}
          </button>
        </div>
      </div>

      {/* Engagement */}
      <div className="px-3 py-2 flex items-center justify-between border-t border-border/50">
        <div className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3 text-[#1877F2]" fill="#1877F2" />
          <span className="text-[10px] text-muted-foreground">142</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <ThumbsUp className="w-4 h-4" />
          <MessageCircle className="w-4 h-4" />
          <Share2 className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

const DesktopAdPreview = ({ creative, productData, cta }: PreviewProps) => {
  return (
    <div className="w-full max-w-[400px] bg-background border border-border rounded-lg overflow-hidden shadow-lg">
      {/* Facebook Header */}
      <div className="p-3 flex items-center gap-3 border-b border-border/50">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Your Business</p>
          <p className="text-xs text-muted-foreground">Sponsored · 🌐</p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Post Text */}
      <div className="px-4 py-3">
        <p className="text-sm text-foreground">
          {productData?.description || 'Check out our amazing product!'}
        </p>
      </div>

      {/* Creative */}
      <div className="relative aspect-video">
        <img 
          src={creative.thumbnail}
          alt="Ad creative"
          className="w-full h-full object-cover"
        />
        {creative.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-7 h-7 text-foreground ml-1" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="p-4 bg-muted/30 border-t border-border/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase">yourstore.com</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {productData?.title || 'Amazing Product'}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              Free shipping on orders over $50
            </p>
          </div>
          <button className="px-6 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md flex-shrink-0">
            {cta}
          </button>
        </div>
      </div>

      {/* Engagement */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            <div className="w-5 h-5 rounded-full bg-[#1877F2] flex items-center justify-center">
              <ThumbsUp className="w-3 h-3 text-white" fill="white" />
            </div>
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <Heart className="w-3 h-3 text-white" fill="white" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">142 reactions</span>
        </div>
        <span className="text-xs text-muted-foreground">12 comments · 5 shares</span>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 flex items-center justify-around border-t border-border/50">
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors">
          <ThumbsUp className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Like</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors">
          <Share2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Share</span>
        </button>
      </div>
    </div>
  );
};
