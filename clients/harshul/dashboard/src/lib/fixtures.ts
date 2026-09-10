import type {
  Employee,
  FollowUp,
  Message,
  Sale,
  Template,
  UpsellRule,
} from "./types";

// Demo data used when Google Sheets credentials are not configured. Dates are
// generated relative to "now" so the Daily Digest always has fresh content to
// show (messages today/yesterday, follow-ups due today + overdue, etc.).

function iso(daysFromNow: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateOnly(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function seedEmployees(): Employee[] {
  return [
    { employee_id: "EMP-001", name: "Mohit", phone: "9826011111", role: "Salesman", active: true },
    { employee_id: "EMP-002", name: "Raju", phone: "9826022222", role: "Installer", active: true },
    { employee_id: "EMP-003", name: "Suresh", phone: "9826033333", role: "Salesman", active: true },
    { employee_id: "EMP-004", name: "Harshul", phone: "9826000000", role: "Admin", active: true },
  ];
}

export function seedSales(): Sale[] {
  return [
    { sale_id: "S-1001", date: dateOnly(-1), customer_name: "Ramesh Kumar", phone: "9425100001", product_category: "Wall Tiles", product_sku: "WT-6030-IVORY", quantity: "45", amount: "54000", salesperson: "Mohit", msg_sequence_status: "active" },
    { sale_id: "S-1002", date: dateOnly(-1), customer_name: "Priya Sharma", phone: "9425100002", product_category: "Sanitaryware", product_sku: "WC-RIMLESS-01", quantity: "2", amount: "23000", salesperson: "Suresh", msg_sequence_status: "active" },
    { sale_id: "S-1003", date: dateOnly(-2), customer_name: "Vikram Patel", phone: "9425100003", product_category: "Floor Tiles", product_sku: "VT-8080-STATUARIO", quantity: "80", amount: "128000", salesperson: "Mohit", msg_sequence_status: "active" },
    { sale_id: "S-1004", date: dateOnly(-3), customer_name: "Anjali Verma", phone: "9425100004", product_category: "Bathroom Fittings", product_sku: "TAP-SS-MIX-02", quantity: "6", amount: "18500", salesperson: "Suresh", msg_sequence_status: "active" },
    { sale_id: "S-1005", date: dateOnly(-5), customer_name: "Sunil Yadav", phone: "9425100005", product_category: "Vitrified Tiles", product_sku: "VT-6060-CARRARA", quantity: "60", amount: "72000", salesperson: "Mohit", msg_sequence_status: "active" },
    { sale_id: "S-1006", date: dateOnly(0), customer_name: "Deepak Joshi", phone: "9425100006", product_category: "Wall Tiles", product_sku: "WT-3045-MARBLE", quantity: "30", amount: "27000", salesperson: "Suresh", msg_sequence_status: "new" },
  ];
}

export function seedMessages(): Message[] {
  const msgs: Message[] = [];
  let n = 1;
  const push = (m: Partial<Message>) => {
    msgs.push({
      msg_id: `M-${String(n).padStart(4, "0")}`,
      sale_id: "",
      phone: "",
      customer_name: "",
      template_id: "",
      message_body: "",
      media_url: "",
      send_at: "",
      status: "sent",
      sent_at: "",
      delivered_at: "",
      read_at: "",
      error: "",
      ...m,
    } as Message);
    n += 1;
  };

  // Today
  push({ sale_id: "S-1001", phone: "9425100001", customer_name: "Ramesh Kumar", template_id: "T-THANKYOU", message_body: "नमस्ते Ramesh जी! Harshul Tiles & Fittings से खरीदारी के लिए धन्यवाद 🙏", send_at: iso(0, 9), status: "delivered", sent_at: iso(0, 9), delivered_at: iso(0, 9, 1) });
  push({ sale_id: "S-1002", phone: "9425100002", customer_name: "Priya Sharma", template_id: "T-THANKYOU", message_body: "नमस्ते Priya जी! धन्यवाद 🙏", send_at: iso(0, 9, 5), status: "read", sent_at: iso(0, 9, 5), delivered_at: iso(0, 9, 6), read_at: iso(0, 10) });
  push({ sale_id: "S-1006", phone: "9425100006", customer_name: "Deepak Joshi", template_id: "T-THANKYOU", message_body: "नमस्ते Deepak जी! धन्यवाद 🙏", send_at: iso(0, 11), status: "sent", sent_at: iso(0, 11) });
  // Yesterday
  push({ sale_id: "S-1003", phone: "9425100003", customer_name: "Vikram Patel", template_id: "T-UPSELL", message_body: "Vikram जी, आपकी floor tiles के साथ matching skirting भी available है!", send_at: iso(-1, 10), status: "delivered", sent_at: iso(-1, 10), delivered_at: iso(-1, 10, 2) });
  push({ sale_id: "S-1004", phone: "9425100004", customer_name: "Anjali Verma", template_id: "T-CARE", message_body: "Anjali जी, taps को साफ रखने के लिए tips 👇", send_at: iso(-1, 12), status: "read", sent_at: iso(-1, 12), delivered_at: iso(-1, 12, 1), read_at: iso(-1, 13) });
  push({ sale_id: "S-1002", phone: "9425100002", customer_name: "Priya Sharma", template_id: "T-UPSELL", message_body: "Priya जी, आपके WC के साथ matching health faucet देखें!", send_at: iso(-1, 14), status: "failed", sent_at: iso(-1, 14), error: "number not on WhatsApp" });
  // Older within 7 days
  push({ sale_id: "S-1005", phone: "9425100005", customer_name: "Sunil Yadav", template_id: "T-REVIEW", message_body: "Sunil जी, कैसा रहा अनुभव? Google पर review दें 🌟", send_at: iso(-3, 11), status: "delivered", sent_at: iso(-3, 11), delivered_at: iso(-3, 11, 1) });
  push({ sale_id: "S-1005", phone: "9425100005", customer_name: "Sunil Yadav", template_id: "T-THANKYOU", message_body: "Sunil जी, धन्यवाद 🙏", send_at: iso(-5, 9), status: "delivered", sent_at: iso(-5, 9), delivered_at: iso(-5, 9, 1) });
  push({ sale_id: "S-1003", phone: "9425100003", customer_name: "Vikram Patel", template_id: "T-THANKYOU", message_body: "Vikram जी, धन्यवाद 🙏", send_at: iso(-2, 9), status: "read", sent_at: iso(-2, 9), delivered_at: iso(-2, 9, 1), read_at: iso(-2, 10) });
  push({ sale_id: "S-1004", phone: "9425100004", customer_name: "Anjali Verma", template_id: "T-THANKYOU", message_body: "Anjali जी, धन्यवाद 🙏", send_at: iso(-3, 9), status: "delivered", sent_at: iso(-3, 9), delivered_at: iso(-3, 9, 1) });
  // A scheduled future message (pending)
  push({ sale_id: "S-1006", phone: "9425100006", customer_name: "Deepak Joshi", template_id: "T-UPSELL", message_body: "Deepak जी, matching floor tiles देखें!", send_at: iso(3, 10), status: "pending" });

  return msgs;
}

export function seedFollowUps(): FollowUp[] {
  return [
    { ticket_id: "FU-201", sale_id: "S-1006", customer_name: "Ramesh Kumar", phone: "9425100001", task: "Send quotation", description: "Wall tiles 45 boxes + adhesive + labour estimate", assigned_to: "Mohit", assigned_phone: "9826011111", due_date: dateOnly(0), status: "pending", created_at: iso(-1), done_at: "", done_by: "", notes: "" },
    { ticket_id: "FU-202", sale_id: "S-1002", customer_name: "Priya Sharma", phone: "9425100002", task: "Follow up call", description: "Confirm delivery slot for WC + basin", assigned_to: "Mohit", assigned_phone: "9826011111", due_date: dateOnly(0), status: "pending", created_at: iso(-1), done_at: "", done_by: "", notes: "" },
    { ticket_id: "FU-203", sale_id: "S-1003", customer_name: "Vikram Patel", phone: "9425100003", task: "Collect balance ₹12,000", description: "Balance pending after delivery", assigned_to: "Mohit", assigned_phone: "9826011111", due_date: dateOnly(-2), status: "pending", created_at: iso(-4), done_at: "", done_by: "", notes: "" },
    { ticket_id: "FU-204", sale_id: "S-1005", customer_name: "Khandwa Road site", phone: "9425100005", task: "Site measurement", description: "Measure bathroom + kitchen for vitrified tiles", assigned_to: "Raju", assigned_phone: "9826022222", due_date: dateOnly(0), status: "pending", created_at: iso(-1), done_at: "", done_by: "", notes: "" },
    { ticket_id: "FU-205", sale_id: "", customer_name: "3 customers", phone: "", task: "Send care tips", description: "Care tips message to recent buyers", assigned_to: "", assigned_phone: "", due_date: dateOnly(-1), status: "pending", created_at: iso(-3), done_at: "", done_by: "", notes: "" },
    { ticket_id: "FU-206", sale_id: "S-1004", customer_name: "Anjali Verma", phone: "9425100004", task: "Ask for referral", description: "Happy customer — ask for architect/contractor referral", assigned_to: "Suresh", assigned_phone: "9826033333", due_date: dateOnly(2), status: "pending", created_at: iso(-1), done_at: "", done_by: "", notes: "" },
    { ticket_id: "FU-207", sale_id: "S-1005", customer_name: "Sunil Yadav", phone: "9425100005", task: "Request Google review", description: "Send review link", assigned_to: "Suresh", assigned_phone: "9826033333", due_date: dateOnly(-1), status: "done", created_at: iso(-4), done_at: iso(-1, 15), done_by: "Suresh", notes: "Customer left 5★ review" },
    { ticket_id: "FU-208", sale_id: "S-1003", customer_name: "Vikram Patel", phone: "9425100003", task: "Delivery coordination", description: "Coordinate installer team", assigned_to: "Raju", assigned_phone: "9826022222", due_date: dateOnly(-1), status: "done", created_at: iso(-3), done_at: iso(-1, 16), done_by: "Raju", notes: "Delivered on time" },
  ];
}

export function seedTemplates(): Template[] {
  return [
    { template_id: "T-THANKYOU", language: "HI+EN", body: "नमस्ते {{name}} जी! 🙏\n{{business}} से {{product}} खरीदने के लिए धन्यवाद।\nकोई भी सवाल हो तो हमें message करें।", media_url: "", delay_days: "0", condition_field: "", condition_value: "", active: true, created_at: iso(-30), updated_at: iso(-30) },
    { template_id: "T-UPSELL", language: "HI+EN", body: "{{name}} जी, आपके {{product}} के साथ ये products बहुत अच्छे लगेंगे 👇\nSpecial price चल रहा है — देखिए!", media_url: "", delay_days: "3", condition_field: "", condition_value: "", active: true, created_at: iso(-30), updated_at: iso(-30) },
    { template_id: "T-CARE", language: "HI", body: "{{name}} जी, आपके {{product}} को नया जैसा रखने के लिए care tips 👇\n1) हल्के cleaner का उपयोग करें\n2) acid से बचें", media_url: "", delay_days: "7", condition_field: "", condition_value: "", active: true, created_at: iso(-30), updated_at: iso(-30) },
    { template_id: "T-REVIEW", language: "HI+EN", body: "{{name}} जी, आपका अनुभव कैसा रहा? 🌟\nहमें Google पर review देकर support करें: {{review_link}}", media_url: "", delay_days: "10", condition_field: "", condition_value: "", active: true, created_at: iso(-30), updated_at: iso(-30) },
    { template_id: "T-REFERRAL", language: "HI+EN", body: "{{name}} जी, अगर आपके किसी दोस्त/architect को tiles चाहिए तो हमें बताएं — दोनों को special discount मिलेगा! 🎁", media_url: "", delay_days: "20", condition_field: "", condition_value: "", active: false, created_at: iso(-30), updated_at: iso(-30) },
    { template_id: "T-WALLTILE-CARE", language: "HI", body: "{{name}} जी, wall tiles की grouting 24 घंटे तक गीली न करें।", media_url: "", delay_days: "2", condition_field: "product_category", condition_value: "Wall Tiles", active: true, created_at: iso(-20), updated_at: iso(-20) },
  ];
}

export function seedUpsellRules(): UpsellRule[] {
  return [
    { rule_id: "U-01", product_category: "Wall Tiles", upsell_product: "Floor Tiles", message_hi: "आपकी wall tiles के साथ matching floor tiles देखें!", message_en: "Check matching floor tiles for your walls!", image_url: "", active: true },
    { rule_id: "U-02", product_category: "Floor Tiles", upsell_product: "Skirting & Borders", message_hi: "Floor tiles के साथ skirting ज़रूरी है — finishing perfect!", message_en: "Add matching skirting for a perfect finish!", image_url: "", active: true },
    { rule_id: "U-03", product_category: "Sanitaryware", upsell_product: "Bathroom Fittings", message_hi: "WC/basin के साथ matching taps & showers लीजिए।", message_en: "Complete your bathroom with matching taps & showers.", image_url: "", active: true },
    { rule_id: "U-04", product_category: "Bathroom Fittings", upsell_product: "Accessories", message_hi: "Towel rod, soap dish जैसे accessories भी लें।", message_en: "Add accessories like towel rods and soap dishes.", image_url: "", active: true },
    { rule_id: "U-05", product_category: "Vitrified Tiles", upsell_product: "Grout & Adhesive", message_hi: "Premium adhesive + grout से tiles लंबे समय तक चलेंगी।", message_en: "Premium adhesive + grout makes tiles last longer.", image_url: "", active: false },
  ];
}
