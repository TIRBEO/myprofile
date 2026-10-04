"use client";

/* ═══════════════════════════════════════════════════════════════════
   What this browser says it is

   Used wherever the account needs a device name without asking: the
   passkey you're about to create, and the session you're reading the
   list from. Nothing here is a fact about the machine — it's the user
   agent talking, so the strings stay short and generic.
   ═══════════════════════════════════════════════════════════════════ */

export type DeviceKind = "computer" | "phone" | "tablet";

export type DeviceHint = {
  name: string;
  os: string;
  browser: string;
  kind: DeviceKind;
};

function browserFrom(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Browser";
}

/**
 * Describe a device from a user-agent string alone. Shared by the session list
 * (every machine's agent arrives on its own session row) and the local browser,
 * so a stored agent string reads the same way as the one you're holding.
 */
export function describeUserAgent(ua: string): DeviceHint {
  const browser = browserFrom(ua);

  if (/iPhone/i.test(ua)) return { name: "iPhone", os: "iOS", browser, kind: "phone" };
  if (/iPad/i.test(ua)) return { name: "iPad", os: "iPadOS", browser, kind: "tablet" };
  if (/Android/i.test(ua)) {
    const tablet = !/Mobile/i.test(ua);
    return {
      name: tablet ? "Android tablet" : "Android phone",
      os: "Android",
      browser,
      kind: tablet ? "tablet" : "phone",
    };
  }
  if (/Mac OS X|Macintosh/i.test(ua)) {
    return { name: "Mac", os: "macOS", browser, kind: "computer" };
  }
  if (/Windows/i.test(ua)) {
    return { name: "Windows PC", os: "Windows", browser, kind: "computer" };
  }
  if (/Linux/i.test(ua)) {
    return { name: "Linux computer", os: "Linux", browser, kind: "computer" };
  }
  return { name: "This device", os: "", browser, kind: "computer" };
}

export function guessDevice(): DeviceHint {
  if (typeof navigator === "undefined") {
    return { name: "This device", os: "", browser: "", kind: "computer" };
  }
  return describeUserAgent(navigator.userAgent);
}
