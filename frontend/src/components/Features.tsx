import { Link, Sparkles, Target, TrendingUp, Zap, BarChart3, RefreshCw } from "lucide-react";

const features = [
  {
    icon: Link,
    title: "Product URL Scraping",
    description: "Just paste your product URL. Our AI automatically fetches images, descriptions, and key details to power your campaigns."
  },
  {
    icon: Sparkles,
    title: "AI-Generated Specs & Scripts",
    description: "Get professional product specifications and creative scripts for video and image ads—tailored to your brand voice."
  },
  {
    icon: Target,
    title: "One-Click Campaign Launch",
    description: "Deploy campaigns across Facebook Ads with intelligent targeting. Google, TikTok, and Shopify integrations coming soon."
  },
  {
    icon: BarChart3,
    title: "Real-Time Monitoring",
    description: "Track performance metrics in real-time with beautiful dashboards. Know exactly how your ads are performing."
  },
  {
    icon: TrendingUp,
    title: "Smart Optimization Suggestions",
    description: "Get AI-powered recommendations to play, pause, clone, or adjust budgets for maximum ROI."
  },
  {
    icon: RefreshCw,
    title: "Automated A/B Testing",
    description: "Continuously test and optimize your creatives with intelligent variation generation and performance tracking."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 relative bg-background">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-secondary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            <span>Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Everything You Need to
            <span className="text-primary"> Win at Ads</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Vibelets combines the power of AI with intuitive design to make campaign management effortless for everyone.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="group relative p-8 rounded-2xl glass-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:scale-105 transition-all">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              
              {/* Content */}
              <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;