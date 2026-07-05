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
      if (!el.classList.contains("hljs")) {
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
      button.className = "copy-code-button absolute top-3 right-3 p-1.5 rounded-md bg-secondary hover:bg-primary/10 hover:text-primary border border-border/80 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer active:scale-90";
      button.setAttribute("aria-label", "Copy code");
      button.innerHTML = COPY_SVG;

      // Add click handler
      button.addEventListener("click", () => {
        const codeElement = pre.querySelector("code");
        if (!codeElement) return;

        const codeText = codeElement.innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          button.innerHTML = CHECK_SVG;
          button.classList.add("text-primary", "border-primary/40", "bg-primary/5");
          
          setTimeout(() => {
            button.innerHTML = COPY_SVG;
            button.classList.remove("text-primary", "border-primary/40", "bg-primary/5");
          }, 2000);
        });
      });

      pre.appendChild(button);
    });
  }, []);

  return null;
}
