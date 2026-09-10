"use client";

import { Check } from "lucide-react";
import { renderTemplate } from "@/lib/utils";

const SAMPLE_VARS: Record<string, string> = {
  name: "Ramesh",
  product: "Wall Tiles",
  business: "Harshul Tiles & Fittings",
  amount: "54,000",
  review_link: "https://g.page/r/harshul",
};

export function WhatsAppPreview({
  body,
  mediaUrl,
  vars,
}: {
  body: string;
  mediaUrl?: string;
  vars?: Record<string, string>;
}) {
  const text = renderTemplate(body || "", { ...SAMPLE_VARS, ...(vars || {}) });
  const now = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="wa-wallpaper rounded-2xl p-4">
      <div className="ml-auto max-w-[85%]">
        <div className="wa-bubble px-2.5 py-2">
          {mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="media"
              className="mb-1.5 max-h-40 w-full rounded-md object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-ink-900">
            {text || "…"}
          </p>
          <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-ink-400">
            {now}
            <Check className="h-3 w-3 text-sky-500" />
            <Check className="-ml-2 h-3 w-3 text-sky-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
