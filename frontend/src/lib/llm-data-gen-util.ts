/**
 * Utility for generating LLM-friendly Markdown from HTTP session data
 */

import { format } from "date-fns";

interface SessionData {
  session: {
    ID: string;
    Timestamp: string;
    DurationMs: number;
    RequestMethod: string;
    RequestPath: string;
    RequestProto: string;
    RequestHost: string;
    RequestURLFull: string;
    ResponseStatusCode: number;
    ResponseStatusText: string;
    RequestBody?: string;
    RequestBodySize: number;
    RequestContentType: string;
    ResponseBody?: string;
    ResponseBodySize: number;
    ResponseContentType: string;
  };
  request_headers: Record<string, string[]>;
  response_headers: Record<string, string[]>;
  query_parameters: Record<string, string[]>;
}

/**
 * Checks if a string is base64 encoded
 */
function isBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(str) || str.length % 4 !== 0) return false;
  try {
    const decoded = atob(str);
    return btoa(decoded) === str;
  } catch {
    return false;
  }
}

/**
 * Decodes a base64 string
 */
function decodeBase64(str: string): string {
  try {
    return atob(str);
  } catch {
    return str;
  }
}

/**
 * Prettifies JSON string if possible
 */
function prettifyJSON(jsonStr: string): string {
  try {
    const obj = JSON.parse(jsonStr);
    return JSON.stringify(obj, null, 2);
  } catch {
    return jsonStr;
  }
}

/**
 * Formats body content based on type and size
 */
function formatBody(
  body: string | undefined,
  contentType: string,
  size: number,
): string {
  if (!body || size === 0) return "_Empty Body_";

  let processedBody = body;
  if (isBase64(body)) {
    processedBody = decodeBase64(body);
  }

  // Handle non-textual or binary-like content types
  const isBinary = /image|audio|video|zip|pdf|octet-stream/.test(contentType);
  if (isBinary) {
    return `[Binary Data: ${size} bytes]`;
  }

  // Truncate if too large (10KB limit for LLM friendliness)
  const MAX_BODY_SIZE = 10240;
  if (processedBody.length > MAX_BODY_SIZE) {
    processedBody =
      processedBody.substring(0, MAX_BODY_SIZE) +
      "\n\n... [Body truncated due to size]";
  }

  if (contentType.includes("json")) {
    return "```json\n" + prettifyJSON(processedBody) + "\n```";
  }

  if (contentType.includes("xml") || contentType.includes("html")) {
    return "```xml\n" + processedBody + "\n```";
  }

  return "```text\n" + processedBody + "\n```";
}

/**
 * Formats headers into an HTTP-like Markdown block
 */
function formatHeaders(headers: Record<string, string[]>): string {
  if (!headers || Object.keys(headers).length === 0) return "_No Headers_";

  let headerStr = "```http\n";
  for (const [key, values] of Object.entries(headers)) {
    headerStr += `${key}: ${values.join(", ")}\n`;
  }
  headerStr += "```";
  return headerStr;
}

/**
 * Generates LLM-friendly Markdown for a single session
 */
export function generateLLMMarkdown(data: SessionData): string {
  const { session, request_headers, response_headers } = data;
  const timeStr = format(new Date(session.Timestamp), "PP pp");

  return `# Session: ${session.ID}
- **Time:** ${timeStr}
- **Duration:** ${session.DurationMs}ms
- **Status:** ${session.ResponseStatusCode} ${session.ResponseStatusText || ""}

## Request
- **Method:** ${session.RequestMethod}
- **URL:** ${session.RequestURLFull}
- **Headers:**
${formatHeaders(request_headers)}

- **Body (${session.RequestContentType || "text/plain"}):**
${formatBody(session.RequestBody, session.RequestContentType, session.RequestBodySize)}

## Response
- **Headers:**
${formatHeaders(response_headers)}

- **Body (${session.ResponseContentType || "text/plain"}):**
${formatBody(session.ResponseBody, session.ResponseContentType, session.ResponseBodySize)}

---
`;
}

/**
 * Generates LLM-friendly Markdown for multiple sessions
 */
export function generateBatchLLMMarkdown(sessions: SessionData[]): string {
  return sessions.map(generateLLMMarkdown).join("\n\n");
}
