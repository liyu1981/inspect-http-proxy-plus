export interface BodyRendererProps {
  body: string;
  contentType: string;
}

export interface BodyRenderer {
  /** Unique ID for the renderer */
  id: string;
  /** Display label for UI elements (e.g., "JSON", "Image") */
  label: string;
  /**
   * Function to determine if this renderer can handle the given content.
   * Returns true if it supports the content type or body pattern.
   */
  match: (contentType: string, body: string) => boolean;
  /** Optional priority: higher priority matches first */
  priority?: number;
}
