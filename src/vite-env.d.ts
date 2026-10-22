/// <reference types="vite/client" />
/// <reference types="@types/dom-chromium-ai" />

interface ReadableStream<R = unknown> {
  [Symbol.asyncIterator](): AsyncIterableIterator<R>;
}
