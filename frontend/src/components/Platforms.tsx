import { Check, Clock } from "lucide-react";

const platforms = [
  {
    name: "Facebook Ads",
    description: "Full Advantage+ campaign automation",
    status: "available",
    features: ["Smart targeting", "Creative optimization", "Budget management"]
  },
  {
    name: "Google Ads",
    description: "Performance Max & Search campaigns",
    status: "coming",
    features: ["Keyword generation", "Smart bidding", "Conversion tracking"]
  },
  {
    name: "TikTok Ads",
    description: "Viral short-form video campaigns",
    status: "coming",
    features: ["Trend integration", "Creator tools", "Spark ads support"]
  },
  {
    name: "Shopify",
    description: "Direct product sync & catalog ads",
    status: "coming",
    features: ["Product feed sync", "Dynamic ads", "Cart integration"]
  }
];

const Platforms = () => {
  return (
    <section id="platforms" className="py-24 relative bg-muted/30">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            One Platform,
            <span className="text-secondary"> All Channels</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Manage all your advertising channels from a single, unified dashboard. More platforms launching soon.
          </p>
        </div>

        {/* Platforms grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {platforms.map((platform) => (
            <div 
              key={platform.name}
              className={`relative p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                platform.status === 'available'
                  ? 'bg-card border-2 border-primary/30 shadow-lg hover:shadow-xl hover:border-primary/50'
                  : 'bg-card border border-border'
              }`}
            >
              {/* Status badge */}
              <div 
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 ${
                  platform.status === 'available'
                    ? 'bg-secondary/15 text-secondary border border-secondary/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {platform.status === 'available' ? (
                  <>
                    <Check className="w-3 h-3" />
                    Available Now
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    Coming Soon
                  </>
                )}
              </div>
              
              {/* Content */}
              <h3 className="text-xl font-semibold mb-2">{platform.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{platform.description}</p>
              
              {/* Features */}
              <ul className="space-y-2">
                {platform.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      platform.status === 'available' ? 'bg-secondary' : 'bg-muted-foreground'
                    }`} />
                    <span className={platform.status === 'available' ? 'text-foreground' : 'text-muted-foreground'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Platforms;