import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import vibeLogo from "@/assets/vibelets-logo-unified.png";
import { cn } from "@/lib/utils";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 backdrop-blur-sm transition-all duration-300 ease-out",
      isScrolled 
        ? "bg-background/95 shadow-lg shadow-foreground/5" 
        : "bg-background/60"
    )}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={vibeLogo} alt="Vibelets" className="h-8 w-auto" />
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            How It Works
          </a>
          <a href="#platforms" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Platforms
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign In
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
