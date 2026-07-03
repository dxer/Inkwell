import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Reveal-on-scroll. Returns [ref, inView]. The consumer toggles a class
 * (e.g. `.is-visible`) or reads `inView` when the element enters the viewport.
 *
 * Respects prefers-reduced-motion: reports `inView = true` immediately so
 * items are visible without animation.
 *
 * `once` (default true): stop observing after first intersection.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { once?: boolean; threshold?: number } = {},
): [RefObject<T>, boolean] {
  const { once = true, threshold = 0.15 } = options
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Reduced motion: show immediately, no observer.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [once, threshold])

  return [ref, inView]
}
