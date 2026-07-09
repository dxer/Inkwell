import { useEffect } from "react";

/**
 * Delegated click listener for code-block copy buttons.
 *
 * The button HTML (with SVG icon) is embedded server-side by highlightHtml().
 * This component only wires up: click → clipboard → swap to checkmark icon.
 */
export function CodeBlockEnhancer({ html }: { html: string }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest(".copy-code-btn") as HTMLButtonElement | null;
      if (!btn) return;
      // Prevent double-fire
      if (btn.dataset.busy === "1") return;

      const wrapper = btn.closest(".code-block-wrapper");
      const codeEl = wrapper?.querySelector("pre code") as HTMLElement | null;
      if (!codeEl) return;

      const text = codeEl.textContent || "";
      btn.dataset.busy = "1";

      const done = () => {
        const checkIcon = btn.dataset.checkIcon || "";
        btn.innerHTML = checkIcon;
        btn.classList.add("copied");
        setTimeout(() => {
          const copyIcon = btn.dataset.copyIcon || "";
          btn.innerHTML = copyIcon;
          btn.classList.remove("copied");
          delete btn.dataset.busy;
        }, 2000);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
          fallbackCopy(text);
          done();
        });
      } else {
        fallbackCopy(text);
        done();
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [html]);

  return null;
}

function fallbackCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
}
