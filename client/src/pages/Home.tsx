import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Clock, Ticket, ArrowLeft, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Home() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col w-full overflow-x-hidden font-sans"
    >
      <Header />

      <main className="flex-1 mt-[72px]">
        {/* HERO SECTION GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 h-[70vh] w-full">
          {/* First Section */}
          <div className="relative group overflow-hidden h-full">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{
                backgroundImage: `url('/2.png')`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--quest-purple))/90] to-transparent opacity-80" />

            <div className="absolute bottom-0 right-0 p-8 md:p-12 lg:p-16 w-full text-right">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="block text-[hsl(var(--quest-yellow))] font-bold tracking-widest text-md mb-2  [text-shadow:0_4px_20px_rgba(255,255,0,1)]">
                  العب في الحاضر
                </span>

                <h1
                  className="text-3xl md:text-5xl lg:text-7xl font-black text-white leading-[0.9] 
        [text-shadow:0_8px_40px_rgba(0,0,0,0.8)]"
                >
                  مدينة
                  <br />
                  الخيال
                </h1>

                <div className="h-1 w-24 bg-[hsl(var(--quest-green))] mt-6 rounded-full mr-auto md:mr-0 md:ml-auto" />
              </motion.div>
            </div>
          </div>

          {/* Second Section */}
          <div className="relative group overflow-hidden h-full">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{
                backgroundImage: `url('/1.png')`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--quest-purple))/90] to-transparent opacity-80" />

            <div className="absolute bottom-0 right-0 p-8 md:p-12 lg:p-16 w-full text-right">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span
                  className="block text-[hsl(var(--quest-yellow))] font-bold tracking-widest text-md md:text-base mb-2 
        [text-shadow:0_4px_20px_rgba(0,0,0,0.7)]"
                >
                  تخيل المستقبل
                </span>

                <h1
                  className="text-3xl md:text-5xl lg:text-7xl font-display font-black text-white leading-[0.9] tracking-tight 
        [text-shadow:0_8px_40px_rgba(0,0,0,0.8)]"
                >
                  محطة
                  <br />
                  الجاذبية
                </h1>

                <div className="h-1 w-24 bg-[hsl(var(--quest-green))] mt-6 rounded-full mr-auto md:mr-0 md:ml-auto" />
              </motion.div>
            </div>
          </div>
        </section>
        {/* BOOK TICKETS CTA */}
        <section className="bg-[hsl(var(--quest-yellow))] py-6">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <span className="text-[hsl(var(--quest-purple))] font-black text-xl md:text-2xl">
              احجز تذاكرك واستمتع بأفضل الأسعار اليوم!
            </span>
            <Link href="/tickets">
              <Button
                className="bg-[hsl(var(--quest-purple))] text-white hover:bg-[hsl(var(--quest-purple))/90] font-bold h-14 px-10 rounded-full text-lg shadow-lg transition-all duration-300 group"
                data-testid="button-book-tickets-cta"
              >
                <Ticket className="w-5 h-5 ml-2" />
                احجز الآن
                <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>

        {/* INFO SECTION */}
        <section className="bg-[hsl(var(--quest-purple))] text-white py-20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-[hsl(var(--quest-yellow))] rounded-full blur-[100px] opacity-20 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(var(--quest-green))] rounded-full blur-[120px] opacity-20 translate-x-1/2 translate-y-1/2" />

          <div className="container mx-auto px-4 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl mx-auto"
            >
              <h3 className="text-[hsl(var(--quest-yellow))] font-bold tracking-widest mb-4">
                اكتشف العجائب
              </h3>
              <h2 className="text-4xl md:text-6xl font-display font-black mb-8 leading-tight">
                ادخل عوالم{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  الزمن
                </span>
              </h2>
              <p className="text-lg md:text-2xl text-white/90 leading-relaxed font-light mb-12">
                استمتع بـ{" "}
                <span className="font-bold text-[hsl(var(--quest-yellow))]">
                  أكثر من 30 لعبة ومنطقة جذب
                </span>{" "}
                تحت سقف واحد. من إثارة مدينة الخيال إلى عجائب الفضاء المتحدية
                للجاذبية، تقدم كويست تجربة غامرة لجميع الأعمار في قلب الدوحة.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <span className="text-4xl font-black text-[hsl(var(--quest-green))] mb-2">
                    +30
                  </span>
                  <span className="text-sm font-bold tracking-wide">
                    لعبة ومنطقة جذب
                  </span>
                </div>
                <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <span className="text-4xl font-black text-[hsl(var(--quest-green))] mb-2">
                    27K
                  </span>
                  <span className="text-sm font-bold tracking-wide">
                    متر مربع
                  </span>
                </div>
                <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <span className="text-4xl font-black text-[hsl(var(--quest-green))] mb-2">
                    3
                  </span>
                  <span className="text-sm font-bold tracking-wide">
                    عوالم زمنية
                  </span>
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
                <div className="text-center">
                  <div className="font-bold text-sm text-[hsl(var(--quest-green))]">
                    الإثنين - الثلاثاء
                  </div>
                  <div className="font-black text-xl">8:30 ص - 6:00 م</div>
                </div>
              </div>
              <div className="p-6 flex items-center justify-center gap-4 text-[hsl(var(--quest-purple))] bg-white">
                <Clock className="w-6 h-6 text-[hsl(var(--quest-green))]" />
                <div className="text-center">
                  <div className="font-bold text-sm text-[hsl(var(--quest-green))]">
                    الأربعاء
                  </div>
                  <div className="font-black text-xl">4:30 م - 10:00 م</div>
                </div>
              </div>
              <div className="p-6 flex items-center justify-center gap-4 text-[hsl(var(--quest-purple))] bg-white">
                <Clock className="w-6 h-6 text-[hsl(var(--quest-green))]" />
                <div className="text-center">
                  <div className="font-bold text-sm text-[hsl(var(--quest-green))]">
                    الخميس - السبت
                  </div>
                  <div className="font-black text-xl">5:30 م - 12:00 ص</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROMO BANNER */}
        <section className="bg-[hsl(var(--quest-yellow))] py-3 overflow-hidden">
          <div className="container mx-auto px-4 flex items-center justify-center text-[hsl(var(--quest-purple))] font-bold tracking-wide text-sm md:text-base text-center">
            <span className="ml-2">
              احصل على منتجات دوحة كويست الرائعة من متجرنا الإلكتروني!
            </span>
            <a
              href="/tickets"
              className="underline decoration-2 underline-offset-4 hover:text-white transition-colors"
            >
              تسوق الآن
            </a>
          </div>
        </section>

        {/* THRILL RIDE SECTION */}
        <section className="relative py-32 bg-[hsl(var(--quest-dark))] text-white overflow-hidden">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          ></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-2">
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--quest-yellow))] text-[hsl(var(--quest-purple))] font-bold text-xs mb-6">
                    <Star className="w-3 h-3 fill-current" />
                    رقم قياسي عالمي
                  </div>

                  <h2 className="text-4xl md:text-6xl font-display font-black mb-6 leading-none">
                    أطول أفعوانية
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-l from-[hsl(var(--quest-yellow))] to-[hsl(var(--quest-green))]">
                      داخلية في العالم
                    </span>
                  </h2>

                  <p className="text-lg text-white/70 mb-8 max-w-lg leading-relaxed">
                    عش إثارة أفعوانية إيبك وبرج سقوط ماغما بلاست. فقط في أكبر
                    مدينة ملاهي داخلية في الدوحة!
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-10">
                    <Button
                      className="bg-[hsl(var(--quest-yellow))] text-[hsl(var(--quest-purple))] hover:bg-white hover:text-[hsl(var(--quest-purple))] font-bold h-14 px-8 rounded-full text-lg shadow-lg shadow-[hsl(var(--quest-yellow))/20] transition-all duration-300 group"
                      data-testid="button-book-tickets-ride"
                    >
                      احجز التذاكر
                      <ArrowLeft className="mr-2 w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </Button>

                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full bg-[#00AA6C]"
                          />
                        ))}
                      </div>
                      <span className="font-bold text-sm">
                        4.9 على تريب أدفايزر
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="order-1 lg:order-1 relative h-[500px]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="relative h-full w-full"
                >
                  <div className="absolute top-0 left-0 w-3/4 h-3/4 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 z-10 -rotate-3 hover:rotate-0 transition-transform duration-500">
                    <img
                      src="/1.png"
                      alt="أفعوانية"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-2/3 h-2/3 rounded-3xl overflow-hidden shadow-2xl border-4 border-[hsl(var(--quest-yellow))] z-20 rotate-3 hover:rotate-0 transition-transform duration-500">
                    <img
                      src="/2.png"
                      alt="زوار سعداء"
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
