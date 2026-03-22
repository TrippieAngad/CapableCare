"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Map } from "@/components/ui/map";
import { SparklesCore } from "@/components/ui/sparkles";

export function SparklesPreview({ onSignInClick }: { onSignInClick?: () => void }) {
  return (
    <div className="relative flex h-[70vh] min-h-[420px] w-full flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute inset-0 opacity-45">
        <Map
          center={[-74.006, 40.7128]}
          zoom={10.8}
          pitch={20}
          bearing={-12}
          dragPan={false}
          scrollZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          touchZoomRotate={false}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),rgba(247,243,234,0.82)_72%)]" />
      <div className="relative z-20 flex flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-['Avenir_Next','Segoe_UI',sans-serif] text-5xl font-extrabold leading-[0.9] tracking-[-0.08em] text-[#102a31] drop-shadow-[0_10px_30px_rgba(18,48,61,0.22)] md:text-7xl lg:text-[6.5rem]">
          CapableCare
        </h1>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#60757b] md:text-base">
          care for elders
        </p>
      </div>

      <div className="relative z-20 mt-6 h-40 w-full max-w-[44rem]">
        <div className="absolute inset-x-20 top-0 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-[#c76f3f] to-transparent blur-sm" />
        <div className="absolute inset-x-20 top-0 h-px w-3/4 bg-gradient-to-r from-transparent via-[#c76f3f] to-transparent" />
        <div className="absolute inset-x-60 top-0 h-[5px] w-1/4 bg-gradient-to-r from-transparent via-[#2f6f72] to-transparent blur-sm" />
        <div className="absolute inset-x-60 top-0 h-px w-1/4 bg-gradient-to-r from-transparent via-[#2f6f72] to-transparent" />

        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1.1}
          particleDensity={900}
          className="h-full w-full"
          particleColor="#16343b"
          speed={0.8}
        />

        <div className="absolute inset-0 h-full w-full bg-[radial-gradient(350px_180px_at_top,transparent_15%,rgba(238,243,241,0.72))]" />
      </div>

      <Button
        className="relative z-20 mt-12 h-14 rounded-full bg-[#16343b] px-10 text-base font-semibold text-white shadow-[0_12px_30px_rgba(22,52,59,0.2)] hover:bg-[#102a31]"
        onClick={onSignInClick}
        type="button"
      >
        sign in or create new
      </Button>
    </div>
  );
}
