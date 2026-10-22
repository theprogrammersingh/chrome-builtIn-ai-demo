/**
 * Safely appends an incoming stream chunk to accumulated text.
 * Handles both delta chunk streams (where each chunk is incremental)
 * and cumulative chunk streams (where each chunk contains the full text so far).
 */
export function appendStreamChunk(accumulated: string, chunk: string): string {
  if (!accumulated) return chunk;
  // If chunk is cumulative, it starts with the accumulated text
  if (chunk.startsWith(accumulated)) {
    return chunk;
  }
  // Otherwise, chunk is an incremental delta
  return accumulated + chunk;
}
