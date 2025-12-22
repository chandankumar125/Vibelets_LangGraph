import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import { X, ImageOff } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const handleError = () => {
    console.error('Failed to load image:', src);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/50 border border-dashed border-muted-foreground/30", className)}>
        <ImageOff className="w-8 h-8 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={cn("cursor-pointer transition-transform hover:scale-[1.02]", className)}
        onClick={() => setIsOpen(true)}
        onError={handleError}
        loading="lazy"
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-[90vw] p-0 bg-background/95 backdrop-blur-sm border-border">
          <VisuallyHidden>
            <DialogTitle>{alt}</DialogTitle>
          </VisuallyHidden>
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 z-50 p-2 rounded-full bg-background/80 hover:bg-background border border-border shadow-md transition-colors"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
          <div className="relative w-full max-h-[85vh] overflow-hidden rounded-lg">
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-contain"
              onError={handleError}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
