import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Paste Your Product URL",
    description: "Simply enter your product page URL and Vibelets automatically extracts images, descriptions, pricing, and key product details.",
    color: "primary"
  },
  {
    number: "02",
    title: "Review AI-Generated Content",
    description: "Our AI creates compelling product specs, ad copy, and creative scripts. Edit and refine to match your brand voice perfectly.",
    color: "secondary"
  },
  {
    number: "03",
    title: "Launch Your Campaign",
    description: "Select your platform, set your budget, and launch. Vibelets handles audience targeting and ad placement automatically.",
    color: "primary"
  },
  {
    number: "04",
    title: "Monitor & Optimize",
    description: "Track performance in real-time and receive AI-powered suggestions to pause, scale, or clone your best-performing ads.",
    color: "secondary"
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-muted/30">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            How <span className="text-primary">Vibelets</span> Works
          </h2>
          <p className="text-lg text-muted-foreground">
            From product URL to running campaign in minutes, not hours. No marketing expertise required.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="absolute left-8 top-20 w-0.5 h-24 bg-border hidden md:block" />
              )}
              
              <div className="flex gap-6 md:gap-10 mb-12 group">
                {/* Step number */}
                <div 
                  className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all duration-300 group-hover:scale-105 ${
                    step.color === 'primary' 
                      ? 'bg-primary text-primary-foreground glow-primary' 
                      : 'bg-secondary text-secondary-foreground glow-secondary'
                  }`}
                >
                  {step.number}
                </div>
                
                {/* Content */}
                <div className="flex-1 pt-2 glass-card p-6 rounded-xl">
                  <h3 className="text-xl md:text-2xl font-semibold mb-3 flex items-center gap-3 text-foreground">
                    {step.title}
                    <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-lg">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;