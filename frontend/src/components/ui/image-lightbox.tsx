import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={cn("cursor-pointer transition-transform hover:scale-[1.02]", className)}
        onClick={() => setIsOpen(true)}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-[90vw] p-0 bg-background/95 backdrop-blur-sm border-border">
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
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
