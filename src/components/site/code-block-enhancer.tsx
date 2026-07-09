import { useEffect } from "react";

/**
 * Copy-button injector for code blocks.
 *
 * Syntax highlighting is done server-side (lib/highlight.ts). This component
 * only adds a copy button. Each <pre> is wrapped in a relative-positioned
 * container div so the button stays fixed at the corner even when the code
 * scrolls horizontally (overflow-x: auto on <pre> would clip/hide an
 * absolutely-positioned child).
 */
export function CodeBlockEnhancer({ html }: { html: string }) {
  useEffect(() => {
    const root = document.querySelector(".prose-reader");
    if (!root) return;

    root.querySelectorAll("pre").forEach((pre) => {
      // Skip if already wrapped
      if (pre.parentElement?.classList.contains("code-block-wrapper")) return;

      const codeEl = pre.querySelector("code");
      const langMatch = codeEl?.className.match(/language-([\w-]+)/);
      const lang = langMatch ? langMatch[1] : "";

      // Create wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";
      wrapper.style.cssText = "position:relative;";

      // Insert wrapper before pre, then move pre inside
      pre.parentNode!.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Language label (top-left)
      if (lang) {
        const label = document.createElement("span");
        label.textContent = lang;
        label.style.cssText =
          "position:absolute;top:6px;left:14px;font-size:11px;font-family:monospace;" +
          "color:rgba(128,128,128,0.65);text-transform:uppercase;letter-spacing:0.05em;" +
          "pointer-events:none;z-index:10;user-select:none;";
        wrapper.appendChild(label);
      }

      // Copy button (top-right) — on the wrapper, not inside <pre>
      const btn = document.createElement("button");
      btn.textContent = "复制";
      btn.style.cssText =
        "position:absolute;top:6px;right:8px;padding:3px 10px;border-radius:6px;" +
        "font-size:11px;background:rgba(128,128,128,0.15);border:1px solid rgba(128,128,128,0.2);" +
        "color:rgba(128,128,128,0.8);cursor:pointer;z-index:10;transition:all .15s ease;" +
        "backdrop-filter:blur(4px);line-height:1.4;";
      btn.setAttribute("aria-label", "复制代码");

      btn.addEventListener("mouseenter", () => {
        btn.style.background = "var(--primary, #cc785c)";
        btn.style.color = "#fff";
        btn.style.borderColor = "var(--primary, #cc785c)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "rgba(128,128,128,0.15)";
        btn.style.color = "rgba(128,128,128,0.8)";
        btn.style.borderColor = "rgba(128,128,128,0.2)";
      });

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const codeElement = pre.querySelector("code");
        if (!codeElement) return;
        const codeText = codeElement.textContent || "";

        const doCopy = async () => {
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(codeText);
            } else {
              const ta = document.createElement("textarea");
              ta.value = codeText;
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
            btn.textContent = "✓ 已复制";
            btn.style.background = "rgba(34,197,94,0.15)";
            btn.style.color = "rgb(22,163,74)";
            btn.style.borderColor = "rgba(34,197,94,0.3)";
            setTimeout(() => {
              btn.textContent = "复制";
              btn.style.background = "rgba(128,128,128,0.15)";
              btn.style.color = "rgba(128,128,128,0.8)";
              btn.style.borderColor = "rgba(128,128,128,0.2)";
            }, 2000);
          } catch {
            btn.textContent = "复制失败";
            setTimeout(() => { btn.textContent = "复制"; }, 2000);
          }
        };
        doCopy();
      });

      wrapper.appendChild(btn);
    });
  }, [html]);

  return null;
}
