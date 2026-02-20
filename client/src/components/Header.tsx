import { Link } from "wouter";
import { Menu, ShoppingBag, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
        scrolled ? "bg-white/95 backdrop-blur-md shadow-md py-2 border-border/10" : "bg-white py-4"
      )}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo Area */}
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="relative font-display font-black text-3xl tracking-tighter select-none">
            <span className="text-[hsl(var(--quest-green))] drop-shadow-sm">Qu</span>
            <span className="text-[hsl(var(--quest-purple))] drop-shadow-sm">est</span>
            <div className="absolute -bottom-1 left-0 w-full h-1 bg-[hsl(var(--quest-yellow))] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded-full" />
          </div>
        </Link>

        {/* Desktop Nav Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Button 
            variant="outline" 
            className="border-[hsl(var(--quest-green))] text-[hsl(var(--quest-green))] hover:bg-[hsl(var(--quest-green))] hover:text-white font-bold tracking-wide transition-all duration-300 rounded-full px-6"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            SHOP NOW
          </Button>

          <Button 
            asChild
            className="bg-[hsl(var(--quest-yellow))] text-[hsl(var(--quest-purple))] hover:bg-[hsl(var(--quest-yellow))/90] hover:scale-105 border-none font-bold tracking-wide shadow-lg shadow-[hsl(var(--quest-yellow))/30] transition-all duration-300 rounded-full px-6"
          >
            <Link href="/tickets">
              <Ticket className="w-4 h-4 mr-2" />
              BUY TICKETS
            </Link>
          </Button>
          
          <Button 
            size="icon"
            className="bg-[hsl(var(--quest-purple))] text-white hover:bg-[hsl(var(--quest-purple))/90] ml-2 rounded-full w-10 h-10"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button 
            size="icon"
            className="bg-[hsl(var(--quest-purple))] text-white rounded-full"
          >
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}
