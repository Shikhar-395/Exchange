"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@repo/ui/components/button";
import { useCallback } from "react";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    if (typeof window === "undefined") return;

    const doc = document as any;
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

    if (!doc.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    const styleId = "theme-transition-styles";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      :root {
        --expo-out: cubic-bezier(0.16, 1, 0.3, 1);
      }

      ::view-transition-group(root) {
        animation-duration: 1.05s;
        animation-timing-function: var(--expo-out);
      }

      ::view-transition-new(root) {
        animation: 1.05s var(--expo-out) reveal-light-top-right-blur;
        mix-blend-mode: normal;
      }

      ::view-transition-old(root),
      .dark::view-transition-old(root) {
        animation: none;
        z-index: -1;
        mix-blend-mode: normal;
      }

      .dark::view-transition-new(root) {
        animation: 1.05s var(--expo-out) reveal-dark-top-right-blur;
        mix-blend-mode: normal;
      }

      @keyframes reveal-dark-top-right-blur {
        from {
          clip-path: circle(0% at 100% 0%);
          filter: blur(24px);
        }
        40% {
          filter: blur(12px);
        }
        to {
          clip-path: circle(150% at 100% 0%);
          filter: blur(0px);
        }
      }

      @keyframes reveal-light-top-right-blur {
        from {
          clip-path: circle(0% at 100% 0%);
          filter: blur(24px);
        }
        40% {
          filter: blur(12px);
        }
        to {
          clip-path: circle(150% at 100% 0%);
          filter: blur(0px);
        }
      }
    `;

    doc.startViewTransition(() => {
      setTheme(nextTheme);
    });
  }, [setTheme, resolvedTheme]);

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
