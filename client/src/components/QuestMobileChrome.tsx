import { Clock3, Menu } from "lucide-react";
import { Link } from "wouter";

export function QuestMobileTopBar() {
  return (
    <div className="h-14 bg-[hsl(var(--quest-purple))] px-4 flex items-center justify-between text-white sm:px-6">
      <Link href="/" className="font-display font-black text-[2rem] leading-none tracking-tight lowercase sm:text-[2.15rem]">
        quest
      </Link>
      <button
        type="button"
        aria-label="فتح القائمة"
        className="h-8 w-8 inline-flex items-center justify-center rounded-sm text-white/70 hover:text-white transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SessionTimerStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`border border-[#f2d9a8] bg-white px-3 py-2 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#8f8f8f]">
        <span className="border-l border-[#e8cf9f] pl-2 font-bold text-[#f3a926]">١٤:٠٩</span>
        <span className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5 text-[#f3a926]" />
          الوقت المتبقي لهذه الجلسة:
        </span>
      </div>
    </div>
  );
}

export function QuestLegalFooter() {
  return (
    <footer className="bg-[hsl(var(--quest-purple))] px-4 py-7 text-center text-xs text-white/90 sm:px-6 sm:py-8">
      <p>&copy; دوحة كويست. جميع الحقوق محفوظة. | الأسئلة والأجوبة - الشروط والأحكام</p>
    </footer>
  );
}
