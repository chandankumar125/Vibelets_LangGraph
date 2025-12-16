import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden bg-background">
      {/* Subtle decorative shapes */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/8 rounded-full blur-2xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/8 rounded-full blur-2xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium mb-8 animate-slide-up text-primary">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Ad Automation</span>
          </div>

          {/* Headline */}
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-slide-up text-foreground"
            style={{ animationDelay: '0.1s' }}
          >
            Launch Ad Campaigns
            <span className="block text-primary mt-2">
              Without the Complexity
            </span>
          </h1>

          {/* Subheadline */}
          <p 
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up"
            style={{ animationDelay: '0.2s' }}
          >
            Vibelets automates your entire ad workflow—from product specs to creative scripts to campaign launch. Just paste your product URL and let AI do the rest.
          </p>

          {/* CTA buttons */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: '0.3s' }}
          >
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl">
              Watch Demo
            </Button>
          </div>

          {/* Trust indicators */}
          <div 
            className="mt-16 flex flex-col items-center gap-4 animate-slide-up"
            style={{ animationDelay: '0.4s' }}
          >
            <p className="text-sm text-muted-foreground">Trusted by marketers at</p>
            <div className="flex items-center gap-8 px-8 py-4 rounded-2xl glass-card">
              <div className="text-xl font-bold text-foreground/60">Shopify</div>
              <div className="text-xl font-bold text-foreground/60">Meta</div>
              <div className="text-xl font-bold text-foreground/60">TikTok</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;