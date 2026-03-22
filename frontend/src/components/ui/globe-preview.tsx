"use client";

import { Globe } from "@/components/ui/globe";

export function GlobePreview() {
  return (
    <div className="relative flex h-[78vh] min-h-[540px] w-full flex-col items-center justify-start overflow-hidden rounded-[32px] border border-[rgba(125,216,208,0.18)] bg-[radial-gradient(circle_at_top,rgba(31,88,92,0.28),transparent_34%),linear-gradient(180deg,rgba(7,16,19,0.98),rgba(11,25,29,0.96))] px-6 pt-12 shadow-[0_32px_80px_rgba(0,0,0,0.42)] backdrop-blur-md">
      <div className="relative z-20 flex flex-col items-center justify-center gap-2 text-center">
        <h1 className="font-['Avenir_Next','Segoe_UI',sans-serif] text-4xl font-extrabold leading-[0.92] tracking-[-0.08em] text-[#f5faf9] drop-shadow-[0_16px_40px_rgba(72,138,141,0.28)] md:text-6xl lg:text-[5.5rem]">
          CapableCare
        </h1>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a4c0c0] md:text-sm">
          By the people for the elderly
        </p>
      </div>

      <div className="relative mt-4 h-[30rem] w-full max-w-[52rem] md:h-[38rem]">
        <Globe className="top-0 max-w-[560px] md:max-w-[760px]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_62%,rgba(73,177,177,0.18),rgba(255,255,255,0)_44%)]" />
        <div className="pointer-events-none absolute inset-x-[18%] top-[12%] z-20 h-24 rounded-full bg-[rgba(90,224,214,0.22)] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-[linear-gradient(180deg,rgba(11,25,29,0),rgba(11,25,29,0.32)_55%,rgba(11,25,29,0.88))]" />
      </div>
    </div>
  );
}
