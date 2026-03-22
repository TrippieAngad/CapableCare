import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export function ButtonColorful({
  className,
  label = "Explore Components",
  ...props
}: ButtonColorfulProps) {
  return (
    <Button
      className={cn(
        "group relative h-10 overflow-hidden px-4",
        "bg-zinc-900 transition-all duration-200 dark:bg-zinc-100",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "absolute inset-0 blur transition-opacity duration-500",
          "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
          "opacity-40 group-hover:opacity-80",
        )}
      />

      <div className="relative flex items-center justify-center gap-2">
        <span className="text-white dark:text-zinc-900">{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/90 dark:text-zinc-900/90" />
      </div>
    </Button>
  );
}
