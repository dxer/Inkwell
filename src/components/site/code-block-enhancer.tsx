"use client";

import { useEffect } from "react";
import hljs from "highlight.js";

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * A client component that scans the DOM inside the article text area to:
 * 1. Initialize highlight.js for raw code blocks.
 * 2. Dynamically inject copy buttons into each <pre> code element container.
 */
export function CodeBlockEnhancer() {
  useEffect(() => {
    // 1. Run highlight.js syntax highlighting
    const codeElements = document.querySelectorAll(".prose-reader pre code");
    codeElements.forEach((el) => {
      // Check both class and dataset to prevent double-highlighting warning
      if (!el.classList.contains("hljs") && !(el as HTMLElement).dataset.highlighted) {
        hljs.highlightElement(el as HTMLElement);
      }
    });

    // 2. Inject copy buttons into code block containers (<pre>)
    const preElements = document.querySelectorAll(".prose-reader pre");
    preElements.forEach((pre) => {
      // Skip if already enhanced
      if (pre.querySelector(".copy-code-button")) return;

      // Make the container relative to hold the absolute button
      pre.classList.add("relative", "group");

      // Create the copy button
      const button = document.createElement("button");
      button.className = "copy-code-button absolute top-3 right-3 p-1.5 rounded-md bg-white/90 dark:bg-neutral-800/90 hover:bg-primary hover:text-white border border-gray-200 dark:border-neutral-600 text-gray-600 dark:text-gray-300 transition-all duration-200 cursor-pointer active:scale-90 z-10 shadow-sm";
      button.setAttribute("aria-label", "Copy code");
      button.innerHTML = COPY_SVG;

      // Add click handler
      button.addEventListener("click", () => {
        const codeElement = pre.querySelector("code");
        if (!codeElement) return;

        // Use textContent instead of innerText for better compatibility
        const codeText = codeElement.textContent || "";

        const copyText = async () => {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(codeText);
            } else {
              // Fallback for older browsers or non-HTTPS
              const textarea = document.createElement("textarea");
              textarea.value = codeText;
              textarea.style.position = "fixed";
              textarea.style.opacity = "0";
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              document.body.removeChild(textarea);
            }

            button.innerHTML = CHECK_SVG;
            button.classList.add("text-primary", "border-primary/40", "bg-primary/5");

            setTimeout(() => {
              button.innerHTML = COPY_SVG;
              button.classList.remove("text-primary", "border-primary/40", "bg-primary/5");
            }, 2000);
          } catch (err) {
            console.error("Copy failed:", err);
          }
        };

        copyText();
      });

      pre.appendChild(button);
    });
  }, []);

  return null;
}
