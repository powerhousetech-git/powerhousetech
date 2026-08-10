"use client";

import { useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    phTour?: {
      start: (opts: {
        id: string;
        steps: { selector?: string; title: string; body: string }[];
      }) => void;
      shouldAutoStart: (id: string) => boolean;
      reset: (id: string) => void;
    };
  }
}

const TOUR_ID = "medspa-roi";

const STEPS = [
  {
    selector: "#overview",
    title: "Start with the overview",
    body: "Six KPIs show what changed after automation — leads, response time, booking rate, show rate, reviews, and recovered revenue.",
  },
  {
    selector: "#overview .grid",
    title: "Watch the response-time win",
    body: "The highlighted response-time card is usually the first ‘wow’ — most leads are contacted in under a minute.",
  },
  {
    selector: "#lead-pipeline",
    title: "Follow the lead pipeline",
    body: "Funnel, sources, and after-hours charts explain where inquiries come from and what used to be missed overnight.",
  },
  {
    selector: "#appointments",
    title: "Protect appointments",
    body: "At-risk rows flag bookings that need a nudge. Reminder effectiveness shows why show-rate improved.",
  },
  {
    selector: "#reactivation",
    title: "Wake dormant patients",
    body: "Campaign table + lapsed buckets turn ‘quiet patients’ into booked revenue.",
  },
  {
    selector: "#revenue-impact",
    title: "Translate it to dollars",
    body: "Payback and the ROI waterfall connect each automation channel to recovered value vs investment.",
  },
  {
    selector: "#activity-log",
    title: "Audit the sheet log",
    body: "Every automated contact, reminder, and booking is recorded here — the paper trail clients trust.",
  },
];

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load failed " + src));
    document.body.appendChild(s);
  });
}

export function DashboardTour() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        loadCss("/css/dashboard-tour.css");
        await loadScript("/js/dashboard-tour.js");
        if (cancelled || !window.phTour) return;
        if (window.phTour.shouldAutoStart(TOUR_ID)) {
          setTimeout(() => {
            window.phTour?.start({ id: TOUR_ID, steps: STEPS });
          }, 800);
        }
      } catch (err) {
        console.warn(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-tour-trigger
      onClick={() => {
        window.phTour?.reset(TOUR_ID);
        window.phTour?.start({ id: TOUR_ID, steps: STEPS });
      }}
    >
      <HelpCircle className="h-4 w-4" />
      Tour
    </Button>
  );
}
