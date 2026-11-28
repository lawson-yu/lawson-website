"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./page-scrollbar.css";

type ScrollMetrics = {
  maxScroll: number;
  scrollTop: number;
  clientHeight: number;
  thumbTop: number;
  thumbHeight: number;
};

type DragState = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  maxScroll: number;
  travel: number;
};

const initialMetrics: ScrollMetrics = {
  maxScroll: 0,
  scrollTop: 0,
  clientHeight: 0,
  thumbTop: 0,
  thumbHeight: 0,
};

export function PageScrollbar({ label }: { label: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    let frame = 0;
    let hideTimer = 0;

    const updateMetrics = () => {
      frame = 0;
      const trackHeight = rootRef.current?.getBoundingClientRect().height ?? 0;
      const scrollHeight = scrollingElement.scrollHeight;
      const clientHeight = scrollingElement.clientHeight || window.innerHeight;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const thumbHeight = maxScroll > 0
        ? Math.min(trackHeight, Math.max(32, trackHeight * clientHeight / scrollHeight))
        : trackHeight;
      const scrollTop = Math.max(0, Math.min(maxScroll, scrollingElement.scrollTop));
      const thumbTop = maxScroll > 0
        ? (trackHeight - thumbHeight) * scrollTop / maxScroll
        : 0;

      setMetrics({ maxScroll, scrollTop, clientHeight, thumbTop, thumbHeight });
    };

    const measure = () => {
      if (!frame) frame = window.requestAnimationFrame(updateMetrics);
    };
    const onScroll = () => {
      setVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), 1000);
      measure();
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.visualViewport?.addEventListener("resize", measure, { passive: true });

    const resizeObserver = new ResizeObserver(measure);
    if (rootRef.current) resizeObserver.observe(rootRef.current);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer);
      dragRef.current = null;
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || metrics.maxScroll <= 0) return;
    const track = rootRef.current?.getBoundingClientRect();
    const thumbHeight = event.currentTarget.getBoundingClientRect().height;
    const travel = track ? track.height - thumbHeight : 0;
    if (travel <= 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: metrics.scrollTop,
      maxScroll: metrics.maxScroll,
      travel,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    scrollingElement.scrollTop = Math.max(
      0,
      Math.min(drag.maxScroll, drag.startScrollTop + (event.clientY - drag.startY) * drag.maxScroll / drag.travel),
    );
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (metrics.maxScroll <= 0) return;
    let nextScrollTop: number;
    switch (event.key) {
      case "ArrowDown":
        nextScrollTop = metrics.scrollTop + 40;
        break;
      case "ArrowUp":
        nextScrollTop = metrics.scrollTop - 40;
        break;
      case "PageDown":
        nextScrollTop = metrics.scrollTop + metrics.clientHeight;
        break;
      case "PageUp":
        nextScrollTop = metrics.scrollTop - metrics.clientHeight;
        break;
      case "Home":
        nextScrollTop = 0;
        break;
      case "End":
        nextScrollTop = metrics.maxScroll;
        break;
      default:
        return;
    }

    event.preventDefault();
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    scrollingElement.scrollTop = Math.max(0, Math.min(metrics.maxScroll, nextScrollTop));
  };

  const percent = metrics.maxScroll > 0
    ? Math.round(metrics.scrollTop / metrics.maxScroll * 100)
    : 0;

  return (
    <div ref={rootRef} className={`kin-page-scrollbar${visible ? " is-visible" : ""}`} aria-hidden={metrics.maxScroll <= 0}>
      <div
        className="kin-page-scrollbar__thumb"
        role="scrollbar"
        aria-label={label}
        aria-controls="home-content"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.round(metrics.maxScroll)}
        aria-valuenow={Math.round(metrics.scrollTop)}
        aria-valuetext={`${percent}%`}
        tabIndex={metrics.maxScroll > 0 ? 0 : -1}
        style={{ top: metrics.thumbTop, height: metrics.thumbHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
