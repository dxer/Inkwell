"use client";

import { useEffect, useState } from "react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  onItemClick?: () => void;
}

/**
 * A client component that extracts H2 and H3 headers from the article content area,
 * generates anchors, and renders a sticky navigation list with scroll spy highlighters.
 */
export function TableOfContents({ onItemClick }: TableOfContentsProps) {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Locate the article container
    const container = document.querySelector(".prose-reader");
    if (!container) return;

    // Find all H2 and H3 headers inside the container
    const headers = container.querySelectorAll("h2, h3");
    const extractedItems: TOCItem[] = [];

    headers.forEach((header, index) => {
      const text = header.textContent || "";
      // Ensure the element has a unique ID
      let id = header.id;
      if (!id) {
        // Generate a clean slug from the header text
        id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-\u4e00-\u9fa5]/g, "") // Keep alphanumeric, spaces, hyphens and Chinese characters
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");
        
        // Handle empty or duplicate IDs
        if (!id || document.getElementById(id)) {
          id = `header-${index}-${Math.random().toString(36).substr(2, 5)}`;
        }
        header.id = id;
      }

      extractedItems.push({
        id,
        text,
        level: header.tagName === "H2" ? 2 : 3,
      });
    });

    setItems(extractedItems);

    // Scroll spy: highlight the header currently in view
    const observer = new IntersectionObserver(
      (entries) => {
        // Find headers intersecting in the top portion of viewport
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0px -75% 0px", // Focus on top ~25% of viewport
      }
    );

    headers.forEach((header) => observer.observe(header));

    return () => {
      headers.forEach((header) => observer.unobserve(header));
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <nav className="space-y-4" aria-label="Table of contents">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-4 pl-3">
        目录大纲
      </h3>
      <ul className="space-y-2 border-l border-border/80 text-[13px] leading-relaxed">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li
              key={item.id}
              style={{
                paddingLeft: item.level === 3 ? "24px" : "12px",
              }}
              className="relative"
            >
              {/* Highlight bar */}
              {isActive && (
                <div className="absolute left-[-1px] top-1 bottom-1 w-[2px] bg-primary rounded-full transition-all" />
              )}
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  // Adjust for sticky header if any, by scrolling slightly above
                  setTimeout(() => {
                    const el = document.getElementById(item.id);
                    if (el) {
                      const offset = 80; // height of sticky header
                      const bodyRect = document.body.getBoundingClientRect().top;
                      const elementRect = el.getBoundingClientRect().top;
                      const elementPosition = elementRect - bodyRect;
                      const offsetPosition = elementPosition - offset;

                      window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth",
                      });
                    }
                  }, 100);
                  
                  // Trigger optional callback to hide TOC drawer
                  onItemClick?.();
                }}
                className={`block transition-colors duration-150 py-0.5 ${
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
