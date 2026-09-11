import type { AIMapping, Employee, Message, MessageStatus } from "./types";

// Demo data used when GOOGLE_SERVICE_ACCOUNT_KEY is not configured. It mirrors
// the real sheet shape: AI_Config maps standard keys → (Hindi) column headers,
// and Sheet1 rows are keyed by those actual headers so the mapping pipeline is
// genuinely exercised. Dates are relative to "today" (IST-ish) so the digest
// always has overdue / due-today / upcoming items.

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function stamp(offset: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// AI_Config: standard key → actual (Hindi) column header used in Sheet1.
export const DEMO_HEADERS: Record<keyof AIMapping, string> = {
  customer_name: "ग्राहक का नाम",
  customer_phone: "मोबाइल",
  next_follow_up_date: "अगला फॉलोअप",
  assigned_employee: "कर्मचारी",
  product_category: "प्रोडक्ट",
  status: "स्थिति",
  sale_amount: "राशि",
  notes: "नोट्स",
  sale_date: "बिक्री तारीख",
};

export function demoMapping(): AIMapping {
  return { ...DEMO_HEADERS };
}

export function demoEmployees(): Employee[] {
  return [
    { name: "Mohit", phone: "9826011111", role: "Salesman" },
    { name: "Raju", phone: "9826022222", role: "Installer" },
    { name: "Suresh", phone: "9826033333", role: "Salesman" },
    { name: "Harshul", phone: "9826000000", role: "Owner" },
  ];
}

// Raw Sheet1 rows keyed by the ACTUAL (Hindi) headers above.
export function demoSheet1(): Record<string, string>[] {
  const H = DEMO_HEADERS;
  const rows: [string, string, number, string, string, string, number, string, number][] = [
    // name, phone, followUpOffset, employee, product, status, amount, note, saleOffset
    ["Ramesh Kumar", "9425100001", -3, "Mohit", "Wall Tiles", "Balance Pending", 54000, "Balance ₹12,000 बाकी", -10],
    ["Priya Sharma", "9425100002", 0, "Mohit", "Sanitaryware", "Contacted", 23000, "Delivery slot confirm करना है", -2],
    ["Vikram Patel", "9425100003", -1, "Suresh", "Floor Tiles", "Follow Up", 128000, "Site visit pending", -5],
    ["Anjali Verma", "9425100004", 2, "Suresh", "Bathroom Fittings", "New", 18500, "", -1],
    ["Sunil Yadav", "9425100005", 5, "Mohit", "Vitrified Tiles", "Closed", 72000, "Happy customer", -8],
    ["Deepak Joshi", "9425100006", 0, "Raju", "Wall Tiles", "New", 27000, "Measurement लेनी है", 0],
    ["Kavita Nair", "9425100007", -2, "Suresh", "Sanitaryware", "Follow Up", 41000, "Quote भेजना है", -6],
    ["Manish Gupta", "9425100008", 3, "Mohit", "Floor Tiles", "Contacted", 96000, "", -3],
    ["Rekha Singh", "9425100009", 1, "Raju", "Bathroom Fittings", "New", 15000, "Installer schedule", -1],
    ["Arjun Mehta", "9425100010", -4, "Suresh", "Wall Tiles", "Balance Pending", 63000, "Balance ₹20,000", -12],
  ];
  return rows.map((r) => ({
    [H.customer_name!]: r[0],
    [H.customer_phone!]: r[1],
    [H.next_follow_up_date!]: dayKey(r[2]),
    [H.assigned_employee!]: r[3],
    [H.product_category!]: r[4],
    [H.status!]: r[5],
    [H.sale_amount!]: String(r[6]),
    [H.notes!]: r[7],
    [H.sale_date!]: dayKey(r[8]),
  }));
}

export function demoMessages(): Message[] {
  const out: Message[] = [];
  let n = 1;
  const add = (
    sale: string,
    name: string,
    phone: string,
    product: string,
    type: string,
    schedOffset: number,
    status: MessageStatus,
    sentOffset: number | null,
  ) => {
    out.push({
      sale_id: sale,
      customer_name: name,
      customer_phone: phone,
      product,
      message_type: type,
      scheduled_date: dayKey(schedOffset),
      status,
      sent_at: sentOffset === null ? "" : stamp(sentOffset, 9 + (n % 6)),
      created_at: stamp(schedOffset - 1, 8),
    });
    n += 1;
  };

  // A funnel that narrows across stages (thank_you → referral).
  const stages: [string, number][] = [
    ["thank_you", 0], ["care_check", 3], ["feedback", 7], ["upsell", 14], ["referral", 30],
  ];
  const buyers: [string, string, string, number][] = [
    ["S-1001", "Ramesh Kumar", "9425100001", -10],
    ["S-1003", "Vikram Patel", "9425100003", -5],
    ["S-1005", "Sunil Yadav", "9425100005", -8],
    ["S-1007", "Kavita Nair", "9425100007", -6],
  ];

  buyers.forEach((b, bi) => {
    const [sale, name, phone, saleOffset] = b;
    stages.forEach(([type, day], si) => {
      const schedOffset = saleOffset + day;
      // Funnel: later stages reached by fewer buyers.
      const reached = si <= 4 - bi;
      if (schedOffset <= 0) {
        // due in the past → sent (mostly) or failed
        const status: MessageStatus = reached ? (si === 2 && bi === 1 ? "failed" : "sent") : "pending";
        add(sale, name, phone, "Tiles", type, schedOffset, status, status === "pending" ? null : schedOffset);
      } else {
        add(sale, name, phone, "Tiles", type, schedOffset, "pending", null);
      }
    });
  });

  // A few sent today + new sale thank-yous
  add("S-1006", "Deepak Joshi", "9425100006", "Wall Tiles", "thank_you", 0, "sent", 0);
  add("S-1002", "Priya Sharma", "9425100002", "Sanitaryware", "thank_you", -2, "sent", 0);
  add("S-1009", "Rekha Singh", "9425100009", "Bathroom Fittings", "thank_you", -1, "sent", 0);
  add("S-1008", "Manish Gupta", "9425100008", "Floor Tiles", "thank_you", -3, "failed", -3);

  return out;
}
