"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiSend, useApi } from "@/lib/client";
import type { UpsellRule } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  Field,
  inputClass,
  Modal,
  Skeleton,
  Toggle,
} from "@/components/primitives";

const PRODUCT_CATEGORIES = [
  "Wall Tiles", "Floor Tiles", "Vitrified Tiles", "Sanitaryware",
  "Bathroom Fittings", "Adhesive & Grout",
];

type Draft = {
  rule_id: string;
  product_category: string;
  upsell_product: string;
  message_hi: string;
  message_en: string;
  image_url: string;
  active: boolean;
};

const emptyDraft: Draft = {
  rule_id: "",
  product_category: "",
  upsell_product: "",
  message_hi: "",
  message_en: "",
  image_url: "",
  active: true,
};

export default function UpsellPage() {
  const { data, loading, refetch } = useApi<{ rules: UpsellRule[] }>("/api/upsell-rules");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const rules = data?.rules ?? [];

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.rule_id) {
        await apiSend("/api/upsell-rules", "PUT", draft);
      } else {
        const { rule_id, ...rest } = draft;
        void rule_id;
        await apiSend("/api/upsell-rules", "POST", rest);
      }
      setDraft(null);
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: UpsellRule) {
    await apiSend("/api/upsell-rules", "PUT", { rule_id: r.rule_id, active: !r.active });
    await refetch();
  }

  async function remove(r: UpsellRule) {
    if (!confirm(`Delete rule ${r.rule_id}?`)) return;
    await apiSend(`/api/upsell-rules?id=${encodeURIComponent(r.rule_id)}`, "DELETE");
    await refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Upsell Rules</h1>
          <p className="text-sm text-ink-500">अपसेल · कौन सा product किसके साथ बेचें</p>
        </div>
        <Button onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white shadow-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Product</th>
                  <th className="px-3 py-2.5 font-semibold">Upsell</th>
                  <th className="px-3 py-2.5 font-semibold">Hindi</th>
                  <th className="px-3 py-2.5 font-semibold">English</th>
                  <th className="px-3 py-2.5 font-semibold">Active</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rules.map((r) => (
                  <tr key={r.rule_id} className={cn(!r.active && "opacity-60")}>
                    <td className="px-3 py-2.5 font-semibold text-ink-900">{r.product_category}</td>
                    <td className="px-3 py-2.5 text-clay-600">{r.upsell_product}</td>
                    <td className="max-w-[14rem] px-3 py-2.5 text-ink-600">{r.message_hi}</td>
                    <td className="max-w-[14rem] px-3 py-2.5 text-ink-600">{r.message_en}</td>
                    <td className="px-3 py-2.5">
                      <Toggle checked={r.active} onChange={() => toggleActive(r)} label="active" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button onClick={() => setDraft({ ...r })} className="mr-2 text-ink-500 hover:text-clay-600" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(r)} className="text-ink-500 hover:text-danger" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {rules.map((r) => (
              <Card key={r.rule_id} className={cn("p-3.5", !r.active && "opacity-60")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink-900">
                    {r.product_category} <span className="text-ink-400">→</span>{" "}
                    <span className="text-clay-600">{r.upsell_product}</span>
                  </p>
                  <Toggle checked={r.active} onChange={() => toggleActive(r)} label="active" />
                </div>
                <p className="mt-1 text-xs text-ink-600">{r.message_hi}</p>
                <p className="text-xs text-ink-500">{r.message_en}</p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setDraft({ ...r })}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" className="text-danger" onClick={() => remove(r)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.rule_id ? `Edit ${draft.rule_id}` : "Add Upsell Rule"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !draft?.product_category || !draft?.upsell_product}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        {draft ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product category">
                <select className={inputClass} value={draft.product_category} onChange={(e) => set("product_category", e.target.value)}>
                  <option value="">Select…</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Upsell product">
                <input className={inputClass} value={draft.upsell_product} onChange={(e) => set("upsell_product", e.target.value)} />
              </Field>
            </div>
            <Field label="Hindi message · हिंदी">
              <textarea rows={2} className={inputClass} value={draft.message_hi} onChange={(e) => set("message_hi", e.target.value)} />
            </Field>
            <Field label="English message">
              <textarea rows={2} className={inputClass} value={draft.message_en} onChange={(e) => set("message_en", e.target.value)} />
            </Field>
            <Field label="Image URL">
              <input className={inputClass} value={draft.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" />
            </Field>
            <label className="flex items-center justify-between rounded-xl border border-line p-3">
              <span className="text-sm font-semibold text-ink-700">Active · चालू</span>
              <Toggle checked={draft.active} onChange={(v) => set("active", v)} label="active" />
            </label>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
