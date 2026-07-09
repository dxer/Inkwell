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
    return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`;
  });
}
