import { AnimatePresence, motion } from "framer-motion";
import { HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { EvervaultCard, Icon } from "@/components/ui/evervault-card";

const rotatingWords = ["care", "trust", "clarity", "support"];

export function EvervaultCardDemo() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % rotatingWords.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="feature-card relative mx-auto flex w-full max-w-[24rem] flex-col border border-black/10 bg-white/60 p-5 backdrop-blur-md">
      <Icon className="absolute -left-3 -top-3 h-6 w-6 text-emerald-600" />
      <Icon className="absolute -bottom-3 -left-3 h-6 w-6 text-emerald-600" />
      <Icon className="absolute -right-3 -top-3 h-6 w-6 text-blue-700" />
      <Icon className="absolute -bottom-3 -right-3 h-6 w-6 text-blue-700" />

      <div className="mb-5 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        Trusted family visibility
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={rotatingWords[wordIndex]}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <EvervaultCard text={rotatingWords[wordIndex]} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 space-y-3">
        <h2 className="text-base font-medium text-slate-900">
          A calmer way to stay close to every visit, update, and next step.
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          Designed for families who want trustworthy updates without chasing texts, calls, or handwritten notes.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <HeartHandshake className="h-4 w-4" />
          Family and caretaker trust signal
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          <Sparkles className="h-4 w-4" />
          Live care visibility
        </div>
      </div>
    </div>
  );
}
