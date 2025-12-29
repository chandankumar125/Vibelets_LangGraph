import { ProductVariant } from '@/types/campaign';
import {
  Layers, Copy, Eye, ShoppingCart, Check, X, DollarSign, Tag
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface VariantsPanelProps {
  variants: ProductVariant[];
  productUrl?: string;
  onVariantSelect?: (variant: ProductVariant) => void;
  showQuickActions?: boolean;
}

export const VariantsPanel = ({
  variants,
  productUrl,
  onVariantSelect,
  showQuickActions = true,
}: VariantsPanelProps) => {
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  if (!variants || variants.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Product Variants</span>
        </div>
        <p className="text-xs text-muted-foreground italic">
          No product variants detected for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">
          Product Variants ({variants.length})
        </span>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {variants.map((variant, idx) => (
          <Card
            key={idx}
            className={cn(
              "hover:border-primary/50 transition-colors",
              !variant.available && "opacity-60"
            )}
          >
            <CardContent className="p-3">
              {/* Variant Value & Availability */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    {variant.value}
                    {!variant.available && (
                      <Badge variant="outline" className="text-xs">
                        <X className="w-3 h-3 mr-1" />
                        Out of Stock
                      </Badge>
                    )}
                    {variant.available && (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Available
                      </Badge>
                    )}
                  </h4>
                </div>
              </div>

              {/* SKU & Price Row */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* SKU */}
                <div className="flex items-center gap-2 p-2 rounded bg-muted/40">
                  <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">SKU</p>
                    <p className="text-xs font-mono font-semibold truncate">
                      {variant.sku || '—'}
                    </p>
                  </div>
                  {variant.sku && (
                    <button
                      onClick={() => handleCopySku(variant.sku!)}
                      className="p-1 rounded hover:bg-primary/10 transition-colors"
                      title="Copy SKU"
                    >
                      {copiedSku === variant.sku ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />
                      )}
                    </button>
                  )}
                </div>

                {/* Price */}
                {variant.price && (
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/40">
                    <DollarSign className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Price</p>
                      <p className="text-xs font-semibold">{variant.price}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions - Only shown when showQuickActions is true */}
              {showQuickActions && (
                <div className="flex gap-2">
                  {/* Only show View button if productUrl is valid */}
                  {productUrl && productUrl.trim() && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => {
                        try {
                          // Validate URL before opening
                          const urlToOpen = productUrl.startsWith('http') ? productUrl : `https://${productUrl}`;
                          const url = new URL(urlToOpen);
                          window.open(url.href, '_blank');
                        } catch (error) {
                          console.error('Invalid product URL:', productUrl, error);
                          // Silently fail - don't open anything if URL is invalid
                        }
                      }}
                      disabled={!variant.available}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => onVariantSelect?.(variant)}
                    disabled={!variant.available}
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Select
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <div className="text-center p-2 rounded bg-muted/30">
          <p className="text-xs text-muted-foreground">Total Variants</p>
          <p className="text-sm font-bold">{variants.length}</p>
        </div>
        <div className="text-center p-2 rounded bg-muted/30">
          <p className="text-xs text-muted-foreground">In Stock</p>
          <p className="text-sm font-bold">
            {variants.filter((v) => v.available).length}
          </p>
        </div>
      </div>
    </div>
  );
};
