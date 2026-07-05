"use client";

import { useEffect, useState } from "react";

/**
 * A client component that displays a thin Terracotta reading progress bar
 * fixed at the very top of the page.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const totalScrollable = docHeight - winHeight;

      if (totalScrollable > 0) {
        const scrolledPercentage = (window.scrollY / totalScrollable) * 100;
        setProgress(Math.min(100, Math.max(0, scrolledPercentage)));
      } else {
        setProgress(0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Trigger initial computation

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 w-full h-[3px] bg-transparent z-50 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-primary transition-all duration-75 ease-out shadow-[0_1px_4px_rgba(var(--primary),0.3)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
