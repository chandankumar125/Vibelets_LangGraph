import { ProductData } from '@/types/campaign';
import {
  Loader2, Package, DollarSign, Tag, FileText, Image,
  TrendingUp, Star, Users, Video, CircleDollarSign,
  ExternalLink, Sparkles, RefreshCw, Layers, Eye, ZoomIn, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { VariantsPanel } from './VariantsPanel';

interface ProductAnalysisPanelProps {
  productData: ProductData | null;
  productUrl: string | null;
  isAnalyzing: boolean;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
}

const insightIcons: Record<string, React.ElementType> = {
  'trending-up': TrendingUp,
  'star': Star,
  'users': Users,
  'video': Video,
  'dollar-sign': CircleDollarSign,
};

const formatInsightValue = (value: any): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
  }
  return String(value);
};

export const ProductAnalysisPanel = ({
  productData,
  productUrl,
  isAnalyzing,
  isRegenerating,
  onRegenerate
}: ProductAnalysisPanelProps) => {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full p-6 animate-fade-in">
        <div className="relative rounded-xl overflow-hidden border bg-muted mb-6">
          <div className="aspect-video flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!productData) return null;

  /* Normalize Images */
  const normalizedImages: string[] =
    (productData as any).downloaded_images?.length
      ? (productData as any).downloaded_images
      : productData.images?.length
        ? productData.images
        : [];

  const mainImage: string | null =
    productData.pageScreenshot ||
    (productData as any).main_image ||
    normalizedImages[0] ||
    null;

  const similarImages: string[] = normalizedImages.slice(1);

  const price: string =
    productData.price && productData.price !== 'Price not found'
      ? productData.price
      : 'Price not found';

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto h-full">

      {/* Main Image - Expandable */}
      {mainImage ? (
        <div
          className="relative rounded-xl overflow-hidden border bg-white group cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setFullscreenImage(mainImage)}
        >
          <div className="relative w-full bg-gradient-to-b from-transparent via-white to-background/10">
            <img
              src={mainImage}
              alt="Product preview"
              className="w-full h-[280px] object-contain group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Badge className="gap-2 bg-black/80 border-white/20 hover:bg-black/90">
                <ZoomIn className="w-4 h-4" />
                Click to Expand
              </Badge>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 z-10">
            <Badge variant="secondary">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Analyzed
            </Badge>
          </div>
        </div>
      ) : (
        <div className="h-[280px] flex items-center justify-center bg-muted/50 rounded-xl">
          <Image className="w-16 h-16 opacity-50" />
        </div>
      )}

      {/* Product Info Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {productData.title}
          </CardTitle>
          {productData.category && (
            <Badge variant="outline">{productData.category}</Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Price + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Price</span>
              </div>
              <p className="font-bold text-lg">{price}</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Tag className="w-4 h-4" />
                <span className="text-xs">SKU</span>
              </div>
              <p className="font-bold text-lg font-mono">{productData.sku || '—'}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-xs">Description</span>
            </div>
            <p className="text-sm line-clamp-3">{productData.description || 'No description available.'}</p>
          </div>

        </CardContent>
      </Card>

      {/* Product Variants */}
      {productData.variants && productData.variants.length > 0 && (
        <VariantsPanel
          variants={productData.variants}
          productUrl={productUrl || undefined}
          showQuickActions={true}
          onVariantSelect={(variant) => {
            console.log('Variant selected:', variant);
            // Variant selection will be handled via chat message
          }}
        />
      )}

      {/* Product Gallery */}
      {similarImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Product Gallery</span>
            <Badge variant="outline" className="text-xs">
              {similarImages.length} images
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {similarImages.map((img, i) => (
              <div
                key={i}
                className="relative rounded-lg overflow-hidden border bg-white group cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setFullscreenImage(img)}
              >
                <img
                  src={img}
                  alt={`Product ${i + 2}`}
                  className="w-full h-48 object-contain bg-muted group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {productData.insights?.length && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Insights
            </h3>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                disabled={isRegenerating}
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", isRegenerating && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>

          {productData.insights.map((insight, i) => {
            const insightIcons: Record<string, React.ElementType> = {
              'trending-up': TrendingUp,
              'star': Star,
              'users': Users,
              'video': Video,
              'dollar-sign': CircleDollarSign,
            };
            const Icon = insightIcons[insight.icon] || Star;
            return (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{insight.label}</p>
                  <p className="text-sm font-medium">
                    {formatInsightValue(insight.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Image Modal */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[95vh] p-0 bg-background/95 backdrop-blur-sm border-border">
          <VisuallyHidden>
            <div>Product Image Fullscreen</div>
          </VisuallyHidden>
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-3 right-3 z-50 p-2 rounded-full bg-background/80 hover:bg-background border border-border shadow-md transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          {fullscreenImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={fullscreenImage}
                alt="Full screen product image"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};
