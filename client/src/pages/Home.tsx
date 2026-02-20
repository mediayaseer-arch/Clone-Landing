import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
      <Header />
      
      <main className="flex-1 mt-[72px]">
        {/* HERO SECTION GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 h-[85vh] w-full">
          {/* Panel 1: Present */}
          <div className="relative group overflow-hidden h-full">
            {/* Amusement park carousel photo */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url('https://pixabay.com/get/ge6ef38ba13b3a745f2e58c5aa3040bfaacba6bc083f1720679083911a9ff320c49de1ad751ffbb8e1c85214661a8864d4fe5463cfdbade35823965b8826be651_1280.jpg')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--quest-purple))/90] to-transparent opacity-80" />
            
            <div className="absolute bottom-0 left-0 p-8 md:p-12 lg:p-16 w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="block text-[hsl(var(--quest-yellow))] font-bold tracking-widest text-sm md:text-base mb-2 uppercase">Play in the present</span>
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-display font-black text-white leading-[0.9] tracking-tight">
                  CITY OF<br />IMAGINATION
                </h1>
                <div className="h-1 w-24 bg-[hsl(var(--quest-green))] mt-6 rounded-full" />
              </motion.div>
            </div>
          </div>

          {/* Panel 2: Future */}
          <div className="relative group overflow-hidden h-full">
            {/* Futuristic ride photo */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url('https://pixabay.com/get/g001a319502020626ae1d6b42fbd90171f288b9866ecfb1e4a405e2de694be5973a25e464511a0794defd32257eacf2622518c2743d0b7eac23478fe51898eb59_1280.jpg')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--quest-purple))/90] to-transparent opacity-80" />
            
            <div className="absolute bottom-0 left-0 p-8 md:p-12 lg:p-16 w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="block text-[hsl(var(--quest-yellow))] font-bold tracking-widest text-sm md:text-base mb-2 uppercase">Imagine the future</span>
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-display font-black text-white leading-[0.9] tracking-tight">
                  GRAVITY<br />STATION
                </h1>
                <div className="h-1 w-24 bg-[hsl(var(--quest-green))] mt-6 rounded-full" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* INFO SECTION */}
        <section className="bg-[hsl(var(--quest-purple))] text-white py-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(var(--quest-yellow))] rounded-full blur-[100px] opacity-20 translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--quest-green))] rounded-full blur-[120px] opacity-20 -translate-x-1/2 translate-y-1/2" />

          <div className="container mx-auto px-4 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl mx-auto"
            >
              <h3 className="text-[hsl(var(--quest-yellow))] font-bold tracking-widest mb-4">DISCOVER THE WONDER</h3>
              <h2 className="text-4xl md:text-6xl font-display font-black mb-8 leading-tight">
                ENTER OUR <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">TIME REALMS</span>
              </h2>
              <p className="text-lg md:text-2xl text-white/90 leading-relaxed font-light mb-12">
                Experience <span className="font-bold text-[hsl(var(--quest-yellow))]">30+ rides and attractions</span> under one roof. 
                From the thrill of the city of imagination to the gravity-defying wonders of space, 
                Quest offers an immersive experience for all ages in the heart of Doha.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                 <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <span className="text-4xl font-black text-[hsl(var(--quest-green))] mb-2">30+</span>
                   <span className="text-sm font-bold tracking-wide">RIDES & ATTRACTIONS</span>
                 </div>
                 <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <span className="text-4xl font-black text-[hsl(var(--quest-green))] mb-2">27K</span>
                   <span className="text-sm font-bold tracking-wide">SQUARE METERS</span>
                 </div>
                 <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <span className="text-4xl font-black text-[hsl(var(--quest-green))] mb-2">3</span>
                   <span className="text-sm font-bold tracking-wide">TIME REALMS</span>
                 </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* OPERATING HOURS BANNER */}
        <section className="bg-white/5 border-y border-white/10 backdrop-blur-md -mt-1 relative z-20">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
              <div className="p-6 flex items-center justify-center gap-4 text-[hsl(var(--quest-purple))] bg-white">
                <Clock className="w-6 h-6 text-[hsl(var(--quest-green))]" />
                <div className="text-center md:text-left">
                  <div className="font-bold text-sm uppercase text-[hsl(var(--quest-green))]">Mon - Tue</div>
                  <div className="font-black text-xl">8:30 AM - 6:00 PM</div>
                </div>
              </div>
              <div className="p-6 flex items-center justify-center gap-4 text-[hsl(var(--quest-purple))] bg-white">
                <Clock className="w-6 h-6 text-[hsl(var(--quest-green))]" />
                <div className="text-center md:text-left">
                  <div className="font-bold text-sm uppercase text-[hsl(var(--quest-green))]">Wednesday</div>
                  <div className="font-black text-xl">4:30 PM - 10:00 PM</div>
                </div>
              </div>
              <div className="p-6 flex items-center justify-center gap-4 text-[hsl(var(--quest-purple))] bg-white">
                <Clock className="w-6 h-6 text-[hsl(var(--quest-green))]" />
                <div className="text-center md:text-left">
                  <div className="font-bold text-sm uppercase text-[hsl(var(--quest-green))]">Thu - Sat</div>
                  <div className="font-black text-xl">5:30 PM - 12:00 AM</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROMO BANNER */}
        <section className="bg-[hsl(var(--quest-yellow))] py-3 overflow-hidden">
          <div className="container mx-auto px-4 flex items-center justify-center text-[hsl(var(--quest-purple))] font-bold tracking-wide text-sm md:text-base text-center">
            <span className="mr-2">⚡️ تسوّق منتجات دوحة كويست المميزة من المتجر الإلكتروني!</span>
            <a href="#" className="underline decoration-2 underline-offset-4 hover:text-white transition-colors">تسوّق الآن</a>
          </div>
        </section>

        {/* THRILL RIDE SECTION */}
        <section className="relative py-32 bg-[hsl(var(--quest-dark))] text-white overflow-hidden">
          {/* Starry background effect */}
          <div className="absolute inset-0 opacity-40" 
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <div className="order-2 lg:order-1">
                 <motion.div
                   initial={{ opacity: 0, x: -50 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   viewport={{ once: true }}
                   transition={{ duration: 0.8 }}
                 >
                   <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--quest-yellow))] text-[hsl(var(--quest-purple))] font-bold text-xs mb-6">
                     <Star className="w-3 h-3 fill-current" />
                     WORLD RECORD HOLDER
                   </div>
                   
                   <h2 className="text-4xl md:text-6xl font-display font-black mb-6 leading-none">
                     WORLD'S TALLEST<br />
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--quest-yellow))] to-[hsl(var(--quest-green))]">INDOOR COASTER</span>
                   </h2>
                   
                   <p className="text-lg text-white/70 mb-8 max-w-lg leading-relaxed">
                     Experience the adrenaline rush of the EpiQ Coaster and the Magma Blast drop tower. 
                     Only at the largest indoor theme park in Doha!
                   </p>
                   
                   <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-10">
                    <Button
                      asChild
                      className="bg-[hsl(var(--quest-yellow))] text-[hsl(var(--quest-purple))] hover:bg-white hover:text-[hsl(var(--quest-purple))] font-bold h-14 px-8 rounded-full text-lg shadow-lg shadow-[hsl(var(--quest-yellow))/20] transition-all duration-300 group"
                    >
                      <Link href="/tickets">
                        احجز التذاكر
                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                     
                     <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/5">
                       <div className="flex gap-0.5">
                         {[1,2,3,4,5].map(i => (
                           <div key={i} className="w-4 h-4 rounded-full bg-[#00AA6C]" /> 
                         ))}
                       </div>
                       <span className="font-bold text-sm">4.9 on TripAdvisor</span>
                     </div>
                   </div>
                 </motion.div>
              </div>

              <div className="order-1 lg:order-2 relative h-[500px]">
                {/* Image Composition */}
                <motion.div
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   transition={{ duration: 0.8 }}
                   className="relative h-full w-full"
                >
                  <div className="absolute top-0 right-0 w-3/4 h-3/4 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 z-10 rotate-3 hover:rotate-0 transition-transform duration-500">
                    {/* Roller coaster interior */}
                    <img 
                      src="https://pixabay.com/get/g651ca04b03a2aeaf0cedcce067fc904ec8f4a3d176be62b482f0a2ceb684ffa18ab5e373ea868bd4efbf5eba7594af699610931cb5e893d53c57e10c293e8f79_1280.jpg" 
                      alt="Roller Coaster" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 w-2/3 h-2/3 rounded-3xl overflow-hidden shadow-2xl border-4 border-[hsl(var(--quest-yellow))] z-20 -rotate-3 hover:rotate-0 transition-transform duration-500">
                    {/* Excited people */}
                    <img 
                      src="https://pixabay.com/get/g8a740c7953ae35febf385f446d891c3dd9d1023b4bae76a66e5c42bcbc74d941d2ac276788035356b6e37d952808fbbbb0882267edf0577c8da958ac5d2f4c86_1280.jpg" 
                      alt="Happy riders" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              </div>

            </div>
          </div>
        </section>

      </main>
      
      <Footer />
    </div>
  );
}
