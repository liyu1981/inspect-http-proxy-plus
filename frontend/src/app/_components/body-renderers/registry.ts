"use client";

import { jsonRenderer } from "./json-renderer";
import { eventStreamRenderer } from "./event-stream-renderer";
import { ollamaStreamRenderer } from "./ollama-stream-renderer";
import type { BodyRenderer } from "./types";

/** Registered body renderer plugins */
const renderers: BodyRenderer[] = [
  jsonRenderer,
  eventStreamRenderer,
  ollamaStreamRenderer,
  // Future renderers (e.g., htmlRenderer, imageRenderer) go here
];

/**
 * Find the best renderer for a given content type and body.
 * Sorted by priority descending.
 */
export function findRenderer(
  contentType: string,
  body: string,
): BodyRenderer | undefined {
  return renderers
    .filter((r) => r.match(contentType, body))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}

/**
 * Get all available renderers for a given content type and body.
 * For now, we only use the primary one, but this allows future multi-view support.
 */
export function getAllAvailableRenderers(
  contentType: string,
  body: string,
): BodyRenderer[] {
  return renderers
    .filter((r) => r.match(contentType, body))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
