// Share a URL with graceful degradation across contexts.
// navigator.share and navigator.clipboard only exist in secure contexts
// (HTTPS or localhost), so over plain http://LAN-IP we fall back to a legacy
// execCommand copy. Returns what actually happened so the caller can toast.
export type ShareResult = "shared" | "copied" | "failed";

export async function shareLink(
  url: string,
  opts?: { title?: string; text?: string }
): Promise<ShareResult> {
  // 1. Native share sheet (mobile / secure contexts)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ url, title: opts?.title, text: opts?.text });
      return "shared";
    } catch (e) {
      // User dismissed the sheet — treat as a no-op success, not an error
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
      // otherwise fall through to copy
    }
  }

  // 2. Async clipboard (secure contexts)
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      // fall through to legacy copy
    }
  }

  // 3. Legacy copy — works on plain http where the above are unavailable
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok ? "copied" : "failed";
  } catch {
    return "failed";
  }
}
