import { useState } from 'react';
import { CreativeOption } from '@/types/campaign';
import { Image, Video, Check, Play, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VideoThumbnailPlaceholder } from './VideoThumbnailPlaceholder';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreativeGalleryPanelProps {
  creatives: CreativeOption[];
  selectedCreative: CreativeOption | null;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
}

const getFormatLabel = (format?: string, aspectRatio?: string) => {
  if (aspectRatio === '9:16') return 'Reel/Story';
  if (aspectRatio === '4:5') return 'Feed Vertical';
  if (aspectRatio === '1.91:1') return 'Landscape';
  if (aspectRatio === '1:1') return 'Square';
  return format || 'Feed';
};

export const CreativeGalleryPanel = ({ creatives, selectedCreative, isRegenerating, onRegenerate }: CreativeGalleryPanelProps) => {
  const [videoPreview, setVideoPreview] = useState<CreativeOption | null>(null);

  const handleVideoClick = (creative: CreativeOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (creative.type === 'video') {
      setVideoPreview(creative);
    }
  };

  const renderCreativeCard = (creative: CreativeOption) => {
    const isSelected = selectedCreative?.id === creative.id;
    const isVideo = creative.type === 'video';
    
    return (
      <div
        key={creative.id}
        onClick={isVideo ? (e) => handleVideoClick(creative, e) : undefined}
        className={cn(
          "group relative rounded-xl overflow-hidden transition-all duration-300",
          "border-2 bg-card",
          "hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-1",
          isVideo && "cursor-pointer",
          isSelected 
            ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20"
            : "border-border/60 hover:border-primary/40"
        )}
      >
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Check className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        )}
        
        {/* Format & Type badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <Badge 
            variant="secondary" 
            className={cn(
              "text-[10px] px-2 py-0.5 gap-1 font-medium",
              "bg-background/90 backdrop-blur-sm border border-border/50 shadow-sm"
            )}
          >
            {isVideo ? <Video className="w-3 h-3" /> : <Image className="w-3 h-3" />}
            {creative.aspectRatio || '1:1'}
          </Badge>
        </div>
        
        {/* Creative image - consistent square container with object-cover */}
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          {isVideo && !creative.thumbnail ? (
            // Video without thumbnail - show placeholder with built-in play button
            <VideoThumbnailPlaceholder aspectRatio={creative.aspectRatio} />
          ) : (
            // Image or video with thumbnail
            <>
              <img 
                src={creative.thumbnail} 
                alt={creative.name}
                className="w-full h-full object-cover"
              />
              {/* Video play overlay - only for videos with thumbnails */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <div className={cn(
                    "w-14 h-14 rounded-full bg-secondary flex items-center justify-center shadow-xl",
                    "transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary-hover",
                    "border border-secondary-dark/50"
                  )}>
                    <Play className="w-6 h-6 text-secondary-foreground ml-0.5" fill="currentColor" />
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />
          
          {/* Creative info - overlaid on image */}
          <div className="absolute inset-x-0 bottom-0 p-3 z-10">
            <p className="text-sm font-semibold text-white truncate drop-shadow-md">
              {creative.name}
            </p>
            <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
              {getFormatLabel(creative.format, creative.aspectRatio)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <Image className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Generated Creatives</h2>
        <p className="text-sm text-muted-foreground">
          AI-generated ads optimized for Facebook
        </p>
      </div>

      {/* Creatives Grid - uniform 2x2 layout */}
      <div className={cn(
        "grid grid-cols-2 gap-4",
        isRegenerating && "opacity-50 pointer-events-none"
      )}>
        {creatives.map(renderCreativeCard)}
      </div>

      {/* Regenerate option */}
      {onRegenerate && !selectedCreative && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1.5", isRegenerating && "animate-spin")} />
            {isRegenerating ? 'Generating new creatives...' : 'Generate different creatives'}
          </Button>
        </div>
      )}

      {/* Video Preview Modal */}
      <Dialog open={!!videoPreview} onOpenChange={(open) => !open && setVideoPreview(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-border/50">
          <DialogTitle className="sr-only">Video Preview</DialogTitle>
          
          {/* Close button */}
          <button
            onClick={() => setVideoPreview(null)}
            className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>

          {videoPreview && (
            <div className="relative">
              {/* Video player */}
              <div className={cn(
                "w-full bg-black flex items-center justify-center",
                videoPreview.aspectRatio === '9:16' ? "aspect-[9/16] max-h-[80vh]" : 
                videoPreview.aspectRatio === '1:1' ? "aspect-square" :
                videoPreview.aspectRatio === '4:5' ? "aspect-[4/5]" :
                "aspect-video"
              )}>
                {videoPreview.videoUrl ? (
                  <video 
                    src={videoPreview.videoUrl} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center p-8">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                      <Video className="w-10 h-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-white">{videoPreview.name}</p>
                      <p className="text-sm text-white/60">
                        Video preview will be available once generated
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        {videoPreview.aspectRatio || '1:1'} • {getFormatLabel(videoPreview.format, videoPreview.aspectRatio)}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Video info bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{videoPreview.name}</p>
                    <p className="text-white/60 text-sm">
                      {getFormatLabel(videoPreview.format, videoPreview.aspectRatio)} • {videoPreview.aspectRatio}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
