// Sanitize Markdown-derived HTML before it is persisted/rendered.
// marked produces raw HTML (including any raw HTML the author typed), and the
// output is later rendered via dangerouslySetInnerHTML on the public site, so
// we run an allow-list sanitizer to prevent stored XSS.

import sanitizeHtmlLib from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "sup", "sub",
  "code", "pre", "blockquote",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "span", "div", "figure", "figcaption",
  "section", "article",
];

const ALLOWED_ATTRIBUTES: sanitizeHtmlLib.IOptions["allowedAttributes"] = {
  "*": ["class", "id"],
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  code: ["class"],
  pre: ["class"],
  span: ["class"],
  td: ["class", "align"],
  th: ["class", "align"],
};

export function sanitizeMarkdownHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Only safe URL schemes; blocks javascript:, data:, etc.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    // Drop disallowed tags but keep their text content (except script/style,
    // which the library strips entirely along with their contents).
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
