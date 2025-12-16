import { ProductData } from '@/types/campaign';
import { Loader2, Package, DollarSign, Tag, FileText, Image, TrendingUp, Star, Users, Video, CircleDollarSign, ExternalLink, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { cn } from '@/lib/utils';
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

export const ProductAnalysisPanel = ({ productData, productUrl, isAnalyzing, isRegenerating, onRegenerate }: ProductAnalysisPanelProps) => {
  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full p-6 animate-fade-in">
        {/* Skeleton Page Screenshot */}
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted mb-6">
          <div className="aspect-video bg-muted relative">
            <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/5 to-muted animate-[shimmer_2s_infinite]" 
                 style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Capturing page screenshot...</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 z-20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{productUrl}</span>
            </div>
          </div>
        </div>

        {/* Skeleton Product Details */}
        <Card className="border-border mb-4">
          <CardHeader className="pb-3">
            <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-5 w-20 bg-muted rounded animate-pulse mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="h-3 w-12 bg-muted rounded animate-pulse mb-2" />
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="h-3 w-12 bg-muted rounded animate-pulse mb-2" />
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div>
              <div className="h-3 w-20 bg-muted rounded animate-pulse mb-2" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div>
              <div className="h-3 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Progress */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Analyzing Your Product</h2>
          <div className="space-y-3">
            {[
              { label: 'Extracting product details', done: true },
              { label: 'Analyzing images', done: true },
              { label: 'Generating insights', done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${i * 200}ms` }}>
                {item.done ? (
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                ) : (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
                <span className={cn("text-sm", item.done ? "text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!productData) return null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page Screenshot Preview */}
      <div className="relative rounded-xl overflow-hidden border border-border">
        <ImageLightbox
          src={productData.pageScreenshot || productData.images[0]} 
          alt="Product page preview" 
          className="w-full h-48 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Analyzed
          </Badge>
        </div>
      </div>

      {/* Product Info */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {productData.title}
          </CardTitle>
          <Badge variant="outline" className="w-fit">{productData.category}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Price</span>
              </div>
              <p className="font-bold text-lg text-foreground">{productData.price}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Tag className="w-4 h-4" />
                <span className="text-xs">SKU</span>
              </div>
              <p className="font-bold text-lg text-foreground">{productData.sku}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-xs">Description</span>
            </div>
            <p className="text-sm text-foreground">{productData.description}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Image className="w-4 h-4" />
              <span className="text-xs">Product Images ({productData.images.length})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {productData.images.map((img, i) => (
                <ImageLightbox
                  key={i}
                  src={img}
                  alt={`Product ${i + 1}`}
                  className="aspect-square rounded-lg bg-muted ring-2 ring-transparent hover:ring-primary/50 transition-all object-cover"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      {productData.insights && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Insights
            </h3>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", isRegenerating && "animate-spin")} />
                {isRegenerating ? 'Regenerating...' : 'Refresh insights'}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {productData.insights.map((insight, i) => {
              const Icon = insightIcons[insight.icon] || Star;
              return (
                <div key={i} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10",
                  isRegenerating && "opacity-50"
                )}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{insight.label}</p>
                    <p className="text-sm font-medium text-foreground truncate">{insight.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
