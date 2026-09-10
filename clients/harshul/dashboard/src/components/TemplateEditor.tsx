"use client";

import { useState } from "react";
import type { Template, TemplateLanguage } from "@/lib/types";
import {
  Button,
  Field,
  inputClass,
  Modal,
  Toggle,
} from "@/components/primitives";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";

const LANGS: TemplateLanguage[] = ["HI", "EN", "HI+EN"];
const VAR_HINTS = ["{{name}}", "{{product}}", "{{business}}", "{{amount}}", "{{review_link}}"];

const PRODUCT_CATEGORIES = [
  "Wall Tiles", "Floor Tiles", "Vitrified Tiles", "Sanitaryware",
  "Bathroom Fittings", "Adhesive & Grout",
];

type Draft = {
  template_id: string;
  language: TemplateLanguage;
  body: string;
  media_url: string;
  delay_days: string;
  condition_field: string;
  condition_value: string;
  active: boolean;
};

function toDraft(t?: Template | null): Draft {
  return {
    template_id: t?.template_id ?? "",
    language: t?.language ?? "HI+EN",
    body: t?.body ?? "",
    media_url: t?.media_url ?? "",
    delay_days: t?.delay_days ?? "0",
    condition_field: t?.condition_field ?? "",
    condition_value: t?.condition_value ?? "",
    active: t?.active ?? true,
  };
}

export function TemplateEditor({
  open,
  template,
  onClose,
  onSave,
}: {
  open: boolean;
  template: Template | null; // null = create
  onClose: () => void;
  onSave: (draft: Draft, isNew: boolean) => Promise<void>;
}) {
  const isNew = !template;
  const [draft, setDraft] = useState<Draft>(toDraft(template));
  const [saving, setSaving] = useState(false);
  const [conditioned, setConditioned] = useState(Boolean(template?.condition_field));

  // Re-seed when the target template changes.
  const [seededId, setSeededId] = useState(template?.template_id ?? "__new__");
  const currentKey = template?.template_id ?? "__new__";
  if (currentKey !== seededId) {
    setDraft(toDraft(template));
    setConditioned(Boolean(template?.condition_field));
    setSeededId(currentKey);
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Draft = {
        ...draft,
        condition_field: conditioned ? "product_category" : "",
        condition_value: conditioned ? draft.condition_value : "",
      };
      await onSave(payload, isNew);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "New Template · नया टेम्पलेट" : `Edit · ${draft.template_id}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !draft.body}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Template ID">
          <input
            className={inputClass}
            value={draft.template_id}
            readOnly={!isNew}
            placeholder="auto"
            onChange={(e) => set("template_id", e.target.value)}
          />
        </Field>
        <Field label="Language · भाषा">
          <select
            className={inputClass}
            value={draft.language}
            onChange={(e) => set("language", e.target.value as TemplateLanguage)}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message body · संदेश">
        <textarea
          rows={4}
          className={inputClass}
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </Field>
      <div className="mb-3 flex flex-wrap gap-1">
        {VAR_HINTS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set("body", `${draft.body}${v}`)}
            className="rounded-md bg-sand-100 px-1.5 py-0.5 font-mono text-xs text-ink-600 hover:bg-sand-200"
          >
            {v}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Media URL">
          <input
            className={inputClass}
            value={draft.media_url}
            onChange={(e) => set("media_url", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Delay · Day X after sale">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.delay_days}
            onChange={(e) => set("delay_days", e.target.value)}
          />
        </Field>
      </div>

      <div className="mb-3 rounded-xl border border-line p-3">
        <label className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-700">
            Condition · केवल जब
          </span>
          <Toggle checked={conditioned} onChange={setConditioned} label="condition" />
        </label>
        {conditioned ? (
          <select
            className={`${inputClass} mt-2`}
            value={draft.condition_value}
            onChange={(e) => set("condition_value", e.target.value)}
          >
            <option value="">Select product category…</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1 text-xs text-ink-400">Always sent (हर sale पर)</p>
        )}
      </div>

      <label className="mb-3 flex items-center justify-between rounded-xl border border-line p-3">
        <span className="text-sm font-semibold text-ink-700">Active · चालू</span>
        <Toggle checked={draft.active} onChange={(v) => set("active", v)} label="active" />
      </label>

      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
        Live preview
      </p>
      <WhatsAppPreview body={draft.body} mediaUrl={draft.media_url} />
    </Modal>
  );
}

export type { Draft as TemplateDraft };
