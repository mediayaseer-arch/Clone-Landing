import { NewsletterForm } from "./NewsletterForm";
import { Facebook, Instagram, Twitter, Youtube, MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[hsl(var(--quest-purple))] text-white pt-20 pb-8 rounded-t-[3rem] mt-[-2rem] relative z-20">
      <div className="container mx-auto px-4">
        
        {/* Newsletter Section */}
        <div className="text-center mb-16 space-y-4">
          <h3 className="text-[hsl(var(--quest-yellow))] font-bold tracking-widest text-sm uppercase">Stay in the Know</h3>
          <h2 className="text-3xl md:text-5xl font-display font-black mb-8">SUBSCRIBE TO OUR NEWSLETTER</h2>
          <NewsletterForm />
        </div>

        <div className="border-t border-white/10 my-12" />

        {/* Links & Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left">
          <div className="space-y-4">
            <h4 className="font-display font-bold text-xl text-[hsl(var(--quest-yellow))]">SAY HELLO</h4>
            <div className="flex flex-col gap-2 text-white/80">
              <a href="#" className="hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2">
                <MapPin className="w-4 h-4" />
                Al Khaleej Street, Doha Oasis, Qatar
              </a>
              <a href="mailto:info@dohaquest.com" className="hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2">
                <Mail className="w-4 h-4" />
                info@dohaquest.com
              </a>
              <a href="tel:+97444103444" className="hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2">
                <Phone className="w-4 h-4" />
                +974 4410 3444
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-bold text-xl text-[hsl(var(--quest-yellow))]">CAREERS</h4>
            <a href="mailto:careers@dohaquest.com" className="block text-white/80 hover:text-white transition-colors">
              careers@dohaquest.com
            </a>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-bold text-xl text-[hsl(var(--quest-yellow))]">FOLLOW US</h4>
            <div className="flex justify-center md:justify-start gap-4">
              <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-[hsl(var(--quest-yellow))] hover:text-[hsl(var(--quest-purple))] transition-all duration-300">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-[hsl(var(--quest-yellow))] hover:text-[hsl(var(--quest-purple))] transition-all duration-300">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-[hsl(var(--quest-yellow))] hover:text-[hsl(var(--quest-purple))] transition-all duration-300">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-[hsl(var(--quest-yellow))] hover:text-[hsl(var(--quest-purple))] transition-all duration-300">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
             <div className="font-display font-black text-4xl tracking-tighter opacity-20 hover:opacity-100 transition-opacity">
               <span className="text-white">Qu</span>
               <span className="text-[hsl(var(--quest-yellow))]">est</span>
             </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-white/40">
          <p>&copy; {new Date().getFullYear()} Doha Quest. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
