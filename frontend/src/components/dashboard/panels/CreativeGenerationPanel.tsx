import { Loader2, Video, Image, Sparkles } from 'lucide-react';

export const CreativeGenerationPanel = () => {
  const creativeItems = [
    { label: 'Video Ad (15s)', progress: 75, done: false },
    { label: 'Video Ad (30s)', progress: 50, done: false },
    { label: 'Static Image Ad', progress: 100, done: true },
    { label: 'Carousel Ad', progress: 100, done: true },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center animate-bounce">
          <Video className="w-4 h-4 text-accent-foreground" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-secondary flex items-center justify-center animate-bounce" style={{ animationDelay: '200ms' }}>
          <Image className="w-4 h-4 text-secondary-foreground" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">Generating Your Creatives</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Our Creative Agent is generating video and image ads optimized for conversion...
      </p>

      {/* Skeleton Preview Grid */}
      <div className="w-full max-w-md mb-6">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className="aspect-square rounded-lg bg-muted overflow-hidden relative animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div 
                className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted"
                style={{ 
                  backgroundSize: '200% 100%', 
                  animation: `shimmer 1.5s infinite linear`,
                  animationDelay: `${i * 150}ms`
                }} 
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {i <= 2 ? (
                  <Video className="w-6 h-6 text-muted-foreground/40" />
                ) : (
                  <Image className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Bars */}
      <div className="w-full max-w-sm space-y-4">
        {creativeItems.map((item, i) => (
          <div key={i} className="space-y-2 animate-fade-in" style={{ animationDelay: `${(i + 4) * 100}ms` }}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              {item.done ? (
                <span className="text-xs text-accent">✓ Done</span>
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${item.done ? 'bg-accent' : 'bg-primary animate-pulse'}`} 
                style={{ width: `${item.progress}%` }} 
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        This usually takes 20-30 seconds...
      </p>
    </div>
  );
};
