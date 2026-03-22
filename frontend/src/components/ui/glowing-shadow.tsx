"use client";

import type { ReactNode } from "react";

interface GlowingShadowButtonProps {
  children: ReactNode;
}

export function GlowingShadow({ children }: GlowingShadowButtonProps) {
  return <div className="glowing-shadow-shell">{children}</div>;
}
