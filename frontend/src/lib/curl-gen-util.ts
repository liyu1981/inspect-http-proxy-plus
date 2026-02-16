/**
 * Utility for generating cURL commands from HTTP session data
 */

interface CurlOptions {
  method: string;
  url: string;
  headers: Record<string, string[]>;
  body?: string;
  contentType?: string;
}

/**
 * Checks if a string is base64 encoded
 */
function isBase64(str: string): boolean {
  if (!str || str.length === 0) {
    return false;
  }

  // Base64 strings should only contain valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

  // Check if it matches base64 pattern and length is multiple of 4
  if (!base64Regex.test(str) || str.length % 4 !== 0) {
    return false;
  }

  // Try to decode and re-encode to verify
  try {
    const decoded = atob(str);
    const reencoded = btoa(decoded);
    return reencoded === str;
  } catch (_e) {
    return false;
  }
}

/**
 * Decodes a base64 string
 */
function decodeBase64(str: string): string {
  try {
    return atob(str);
  } catch (_e) {
    return str; // Return original if decoding fails
  }
}

/**
 * Generates a cURL command string from HTTP request data
 */
export function generateCurlCommand(options: CurlOptions): string {
  const { method, url, headers, body } = options;

  let curlCommand = "curl";

  // Add method
  if (method && method !== "GET") {
    curlCommand += ` -X ${method}`;
  }

  // Add headers
  for (const [key, values] of Object.entries(headers)) {
    // Escape single quotes in header values
    const escapedValue = values.join(", ").replace(/'/g, "'\\''");
    curlCommand += ` \\\n  -H '${key}: ${escapedValue}'`;
  }

  // Add body if present
  if (body) {
    // Check if body is base64 encoded and decode if necessary
    let processedBody = body;
    if (isBase64(body)) {
      processedBody = decodeBase64(body);
    }

    // Escape single quotes in body
    const escapedBody = processedBody.replace(/'/g, "'\\''");
    curlCommand += ` \\\n  -d '${escapedBody}'`;
  }

  // Add URL (always last)
  curlCommand += ` \\\n  '${url}'`;

  return curlCommand;
}

/**
 * Copies text to clipboard
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
}
