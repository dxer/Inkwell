import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import yaml from "highlight.js/lib/languages/yaml";
import shell from "highlight.js/lib/languages/shell";

// Register common languages (same set as the client enhancer).
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("java", java);
hljs.registerLanguage("yaml", yaml);

// Map of common aliases to registered language names.
const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  py: "python",
  rb: "ruby",
  rs: "rust",
  golang: "go",
  text: "",
  plaintext: "",
  txt: "",
};

// Escape regex special chars in HTML entity sequences for the split pattern.
const CODE_BLOCK_RE = /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g;

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Apply server-side syntax highlighting to article HTML.
 *
 * Finds every `<pre><code class="language-X">…</code></pre>` block, runs
 * highlight.js, and replaces it with highlighted HTML so the SSR response
 * already contains the syntax colors — no client-side flash.
 */
export function highlightHtml(html: string): string {
  return html.replace(CODE_BLOCK_RE, (match, className: string | undefined, rawCode: string) => {
    // Parse language from className like "language-js" or "hljs language-js"
    let lang = "";
    if (className) {
      const m = className.match(/language-([\w-]+)/);
      if (m) lang = m[1];
    }
    // Resolve alias → registered language name
    const resolved = lang ? (LANG_ALIASES[lang] ?? lang) : "";

    const code = unescapeHtml(rawCode);

    let highlighted: string;
    try {
      if (resolved && hljs.getLanguage(resolved)) {
        highlighted = hljs.highlight(code, { language: resolved }).value;
      } else {
        // Auto-detect or fall back to plain escaped text
        highlighted = hljs.highlightAuto(code).value;
      }
    } catch {
      // On any error, return the original block untouched.
      return match;
    }

    const langClass = lang ? ` language-${lang}` : "";
    const langLabel = lang ? `<span class="code-lang-label">${lang}</span>` : "";
    const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    return `<div class="code-block-wrapper">${langLabel}<button type="button" class="copy-code-btn" aria-label="复制代码" data-copy-icon="${escapeAttr(copyIcon)}" data-check-icon="${escapeAttr(checkIcon)}">${copyIcon}</button><pre><code class="hljs${langClass}">${highlighted}</code></pre></div>`;
  });
}
