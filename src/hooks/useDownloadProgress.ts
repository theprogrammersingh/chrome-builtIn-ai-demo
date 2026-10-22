import { useState, useCallback } from "react";

export function useDownloadProgress() {
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const monitorCallback = useCallback((m: EventTarget) => {
    m.addEventListener("downloadprogress", (e: Event) => {
      const progressEvt = e as ProgressEvent;
      let progress = 0;
      if (typeof progressEvt.total === "number" && progressEvt.total > 0) {
        progress = (progressEvt.loaded / progressEvt.total) * 100;
      } else if (typeof progressEvt.loaded === "number") {
        progress = progressEvt.loaded <= 1 ? progressEvt.loaded * 100 : Math.min(progressEvt.loaded, 100);
      }
      setDownloadProgress(Math.min(Math.round(progress), 100));
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
