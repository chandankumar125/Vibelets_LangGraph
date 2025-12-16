import { useState, useRef } from 'react';
import { AvatarOption } from '@/types/campaign';
import { User, Check, Play, Pause, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AvatarPreviewPanelProps {
  avatars: AvatarOption[];
  selectedAvatar: AvatarOption | null;
}

export const AvatarPreviewPanel = ({ avatars, selectedAvatar }: AvatarPreviewPanelProps) => {
  const [previewAvatar, setPreviewAvatar] = useState<AvatarOption | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePreview = (avatar: AvatarOption) => {
    setPreviewAvatar(avatar);
    setIsPlaying(true);
  };

  const handleClosePreview = () => {
    setPreviewAvatar(null);
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <User className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">AI Video Presenters</h2>
        <p className="text-sm text-muted-foreground">
          Preview how each avatar will appear in your Facebook ad
        </p>
      </div>

      {/* Vertical Facebook-style avatar cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {avatars.map((avatar, index) => {
          const isSelected = selectedAvatar?.id === avatar.id;
          return (
            <div
              key={avatar.id}
              className={cn(
                "relative rounded-xl border overflow-hidden transition-all group cursor-pointer animate-fade-in",
                isSelected 
                  ? "border-primary ring-2 ring-primary"
                  : "border-border bg-card hover:border-primary/50"
              )}
              style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'backwards' }}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10 animate-scale-in">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              
              {/* Vertical video-style preview - 9:16 aspect ratio like Facebook Reels */}
              <div className="relative aspect-[9/14] bg-muted overflow-hidden">
                <img 
                  src={avatar.image} 
                  alt={avatar.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/90 to-transparent" />
                
                {/* Avatar info overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <h3 className={cn(
                    "font-semibold text-sm",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {avatar.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {avatar.style}
                  </p>
                </div>
                
                {/* Play button overlay */}
                {avatar.videoPreview && (
                  <button
                    onClick={() => handlePreview(avatar)}
                    className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-110">
                      <Play className="w-7 h-7 text-primary-foreground ml-1" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewAvatar} onOpenChange={() => handleClosePreview()}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background border-border">
          {previewAvatar && (
            <div className="relative">
              <button
                onClick={handleClosePreview}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
              
              <div className="aspect-video bg-muted relative">
                <video
                  ref={videoRef}
                  src={previewAvatar.videoPreview}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                <button
                  onClick={togglePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-background/80 flex items-center justify-center">
                    {isPlaying ? (
                      <Pause className="w-8 h-8 text-foreground" />
                    ) : (
                      <Play className="w-8 h-8 text-foreground ml-1" />
                    )}
                  </div>
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary">
                    <img 
                      src={previewAvatar.image} 
                      alt={previewAvatar.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{previewAvatar.name}</h3>
                    <p className="text-sm text-muted-foreground">{previewAvatar.style}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Preview how this AI presenter delivers your product message. 
                  Select this avatar in the chat to use them for your ad.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
