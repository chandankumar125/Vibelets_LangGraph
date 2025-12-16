import { UnifiedMetrics, PerformanceMetric } from '@/types/campaign';
import { useCountUp, formatMetricValue, calculateTrendPercentage } from '@/hooks/useCountUp';
import { DollarSign, TrendingUp, Percent, ShoppingCart, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricsGridProps {
  metrics: UnifiedMetrics;
  isRefreshing?: boolean;
}

interface MetricCellProps {
  metric: PerformanceMetric;
  icon: React.ElementType;
  index: number;
  isRefreshing?: boolean;
}

const MetricCell = ({ metric, icon: Icon, index, isRefreshing }: MetricCellProps) => {
  const animatedValue = useCountUp(metric.value, { 
    delay: index * 50, 
    decimals: metric.format === 'number' ? 0 : 2 
  });

  const trendPercentage = calculateTrendPercentage(metric.value, metric.previousValue);
  const isPositive = metric.trend === 'up';
  const isNegative = metric.trend === 'down';

  return (
    <div 
      className={cn(
        "flex flex-col items-center text-center py-3 px-4 border-r border-border/30 last:border-r-0 animate-fade-in flex-1 transition-all duration-300",
        isRefreshing && "opacity-60 scale-95"
      )} 
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{metric.label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn(
          "text-xl font-bold text-foreground transition-transform duration-300",
          !isRefreshing && "animate-pulse-once"
        )}>
          {formatMetricValue(animatedValue, metric.format)}
        </span>
        <span className={cn(
          "text-xs font-medium transition-opacity duration-300",
          isPositive && "text-secondary",
          isNegative && "text-destructive",
          !isPositive && !isNegative && "text-muted-foreground"
        )}>
          {trendPercentage}
        </span>
      </div>
    </div>
  );
};

// Icon mapping for each metric
const metricIcons: Record<string, React.ElementType> = {
  'total-spent': DollarSign,
  'profit': TrendingUp,
  'roi': Percent,
  'conversions': ShoppingCart,
  'aov': Receipt,
};

export const MetricsGrid = ({ metrics, isRefreshing }: MetricsGridProps) => {
  const metricsList = [
    metrics.totalSpent,
    metrics.profit,
    metrics.roi,
    metrics.conversions,
    metrics.aov,
  ];

  return (
    <div className="p-4">
      <div className={cn(
        "glass-card rounded-xl overflow-hidden transition-all duration-300",
        isRefreshing && "ring-2 ring-primary/20"
      )}>
        <div className="flex divide-x divide-border/30">
          {metricsList.map((metric, index) => (
            <MetricCell 
              key={metric.id} 
              metric={metric} 
              icon={metricIcons[metric.id] || DollarSign}
              index={index}
              isRefreshing={isRefreshing}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
