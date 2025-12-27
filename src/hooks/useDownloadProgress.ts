import { useState, useCallback } from "react";

export function useDownloadProgress() {
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const monitorCallback = useCallback((m: EventTarget) => {
    m.addEventListener("downloadprogress", (e: any) => {
      const progress = (e.loaded / e.total) * 100;
      setDownloadProgress(progress);
    });
  }, []);

  const resetProgress = useCallback(() => {
    setDownloadProgress(null);
  }, []);

  return {
    downloadProgress,
    monitorCallback,
    resetProgress,
    isDownloading: downloadProgress !== null && downloadProgress < 100,
  };
}
