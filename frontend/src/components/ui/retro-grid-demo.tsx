"use client";

import { ButtonColorful } from "@/components/ui/button-colorful";
import { RetroGrid } from "@/components/ui/retro-grid";

export function RetroGridDemo() {
  return (
    <div className="relative flex h-[70vh] min-h-[420px] w-full flex-col items-center justify-center overflow-hidden rounded-[32px] border border-[rgba(22,52,59,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.16))] p-8 shadow-[0_28px_60px_rgba(38,68,73,0.12)] backdrop-blur-md">
      <RetroGrid className="opacity-70" />
      <h1 className="relative z-10 text-center font-['Baskerville','Palatino_Linotype',serif] text-6xl leading-[0.88] tracking-[-0.06em] text-[#16343b] drop-shadow-[0_10px_30px_rgba(18,48,61,0.18)] md:text-8xl lg:text-[7rem]">
        Capable Care
      </h1>
      <div className="relative z-10 mt-8">
        <ButtonColorful label="Enter Portal" />
      </div>
    </div>
  );
}
