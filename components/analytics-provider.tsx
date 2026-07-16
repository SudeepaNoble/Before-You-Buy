"use client";

import {
  Analytics,
  type BeforeSendEvent,
} from "@vercel/analytics/next";
import { sanitizeAnalyticsUrl } from "@/lib/analytics";

export function AnalyticsProvider() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        if ("url" in event && typeof event.url === "string") {
          return {
            ...event,
            url: sanitizeAnalyticsUrl(event.url),
          };
        }

        return event;
      }}
    />
  );
}
