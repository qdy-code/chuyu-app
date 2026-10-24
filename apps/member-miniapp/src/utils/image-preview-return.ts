// Native WeChat image preview shows the same page again when it closes.
// Consume only that show event; ordinary later visits still reload the catalog.
export function createImagePreviewReturnGuard() {
  let pendingReturn = false;
  return {
    start() { pendingReturn = true; },
    cancel() { pendingReturn = false; },
    consumeReturn(): boolean {
      const returning = pendingReturn;
      pendingReturn = false;
      return returning;
    },
  };
}
