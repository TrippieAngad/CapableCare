"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  name: string;
  url: string;
  icon: LucideIcon;
}

interface NavBarProps {
  items: NavItem[];
  className?: string;
  defaultActive?: string;
  activeItem?: string;
  onItemClick?: (item: NavItem) => void;
}

export function AnimeNavBar({
  items,
  className,
  defaultActive = "overview",
  activeItem,
  onItemClick,
}: NavBarProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [internalActive, setInternalActive] = useState<string>(defaultActive);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (activeItem) {
      setInternalActive(activeItem);
    }
  }, [activeItem]);

  if (!mounted) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-center">
        <motion.div
          className="relative flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-black/50 px-2 py-2 shadow-lg backdrop-blur-lg"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = internalActive === item.id;
            const isHovered = hoveredTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setInternalActive(item.id);
                  onItemClick?.(item);
                }}
                onMouseEnter={() => setHoveredTab(item.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className={cn(
                  "relative cursor-pointer rounded-full px-4 py-3 text-sm font-semibold text-white/70 transition-all duration-300 hover:text-white md:px-6",
                  item.name === "Support" && "glowing-shadow-button",
                  isActive && "text-white",
                )}
                type="button"
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 -z-10 overflow-hidden rounded-full"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0.3, 0.5, 0.3],
                      scale: [1, 1.03, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-[#2f6f72]/25 blur-md" />
                    <div className="absolute inset-[-4px] rounded-full bg-[#2f6f72]/20 blur-xl" />
                    <div className="absolute inset-[-8px] rounded-full bg-[#2f6f72]/15 blur-2xl" />
                    <div className="absolute inset-[-12px] rounded-full bg-[#2f6f72]/5 blur-3xl" />
                    <div className="animate-pulse-slow absolute inset-0 bg-gradient-to-r from-[#2f6f72]/0 via-[#2f6f72]/20 to-[#2f6f72]/0" />
                  </motion.div>
                )}

                <span className="relative z-10 hidden md:inline">{item.name}</span>
                <motion.span
                  className="relative z-10 md:hidden"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon size={18} strokeWidth={2.5} />
                </motion.span>

                <AnimatePresence>
                  {isHovered && !isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 -z-10 rounded-full bg-white/10"
                    />
                  )}
                </AnimatePresence>

                {isActive && (
                  <motion.div
                    layoutId="anime-mascot"
                    className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  >
                    <div className="relative h-12 w-12">
                      <motion.div
                        className="absolute left-1/2 h-10 w-10 -translate-x-1/2 rounded-full bg-white"
                        animate={
                          hoveredTab === item.id
                            ? {
                                scale: [1, 1.1, 1],
                                rotate: [0, -5, 5, 0],
                                transition: {
                                  duration: 0.5,
                                  ease: "easeInOut",
                                },
                              }
                            : {
                                y: [0, -3, 0],
                                transition: {
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                },
                              }
                        }
                      >
                        <motion.div
                          className="absolute h-2 w-2 rounded-full bg-black"
                          animate={
                            hoveredTab === item.id
                              ? {
                                  scaleY: [1, 0.2, 1],
                                  transition: {
                                    duration: 0.2,
                                    times: [0, 0.5, 1],
                                  },
                                }
                              : {}
                          }
                          style={{ left: "25%", top: "40%" }}
                        />
                        <motion.div
                          className="absolute h-2 w-2 rounded-full bg-black"
                          animate={
                            hoveredTab === item.id
                              ? {
                                  scaleY: [1, 0.2, 1],
                                  transition: {
                                    duration: 0.2,
                                    times: [0, 0.5, 1],
                                  },
                                }
                              : {}
                          }
                          style={{ right: "25%", top: "40%" }}
                        />
                        <motion.div
                          className="absolute h-1.5 w-2 rounded-full bg-pink-300"
                          animate={{ opacity: hoveredTab === item.id ? 0.8 : 0.6 }}
                          style={{ left: "15%", top: "55%" }}
                        />
                        <motion.div
                          className="absolute h-1.5 w-2 rounded-full bg-pink-300"
                          animate={{ opacity: hoveredTab === item.id ? 0.8 : 0.6 }}
                          style={{ right: "15%", top: "55%" }}
                        />
                        <motion.div
                          className="absolute h-2 w-4 rounded-full border-b-2 border-black"
                          animate={
                            hoveredTab === item.id
                              ? { scaleY: 1.5, y: -1 }
                              : { scaleY: 1, y: 0 }
                          }
                          style={{ left: "30%", top: "60%" }}
                        />
                        <AnimatePresence>
                          {hoveredTab === item.id && (
                            <>
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className="absolute -right-1 -top-1 h-2 w-2 text-yellow-300"
                              >
                                ✨
                              </motion.div>
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{ delay: 0.1 }}
                                className="absolute -top-2 left-0 h-2 w-2 text-yellow-300"
                              >
                                ✨
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <motion.div
                        className="absolute -bottom-1 left-1/2 h-4 w-4 -translate-x-1/2"
                        animate={
                          hoveredTab === item.id
                            ? {
                                y: [0, -4, 0],
                                transition: {
                                  duration: 0.3,
                                  repeat: Infinity,
                                  repeatType: "reverse",
                                },
                              }
                            : {
                                y: [0, 2, 0],
                                transition: {
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: 0.5,
                                },
                              }
                        }
                      >
                        <div className="h-full w-full origin-center rotate-45 bg-white" />
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
