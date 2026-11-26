"use client";

import { useEffect, useRef } from "react";
import {
  recordArticleVisitAction,
  recordProjectVisitAction,
} from "@/server/visitor-actions";

export function VisitTracker({
  kind,
  targetId,
}: {
  kind: "article" | "project";
  targetId: string;
}) {
  const trackedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${kind}:${targetId}`;
    if (trackedKeyRef.current === key) return;
    trackedKeyRef.current = key;

    const record =
      kind === "article"
        ? recordArticleVisitAction(targetId)
        : recordProjectVisitAction(targetId);
    void record.catch(() => {});
  }, [kind, targetId]);

  return null;
}
