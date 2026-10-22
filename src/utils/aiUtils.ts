/**
 * Safely awaits an AI availability check with a timeout to prevent UI hanging.
 * If the promise takes longer than timeoutMs or rejects, resolves to fallback.
 */
export async function checkAvailabilityWithTimeout<T extends string>(
  promise: Promise<T>,
  fallback: T = "unavailable" as T,
  timeoutMs = 4000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`AI availability check timed out after ${timeoutMs}ms`);
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    console.warn("AI availability check rejected:", err);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Returns a user-friendly label and MUI Chip color for an API availability state.
 */
export function getAvailabilityBadgeProps(
  availability: string,
  modelName = "Model"
): { label: string; color: "success" | "warning" | "error" | "default" | "info" } {
  switch (availability) {
    case "available":
    case "readily":
      return { label: `${modelName} Ready`, color: "success" };
    case "downloadable":
      return { label: "Download Required", color: "warning" };
    case "downloading":
      return { label: "Downloading...", color: "info" };
    case "unavailable":
      return { label: `${modelName} Unavailable`, color: "error" };
    case "unsupported":
      return { label: "API Unsupported", color: "default" };
    case "checking":
    default:
      return { label: "Checking Availability...", color: "default" };
  }
}
