"use client";

import * as React from "react";
import { CreditCard, FileText, Home, Info } from "lucide-react";
import { AnimeNavBar } from "@/components/ui/anime-navbar";

const items = [
  { id: "home", name: "Home", url: "#", icon: Home },
  { id: "convert", name: "Convert", url: "#", icon: FileText },
  { id: "pricing", name: "Pricing", url: "#", icon: CreditCard },
  { id: "about", name: "About", url: "#", icon: Info },
];

export function AnimeNavBarDemo() {
  return <AnimeNavBar items={items} defaultActive="home" />;
}
