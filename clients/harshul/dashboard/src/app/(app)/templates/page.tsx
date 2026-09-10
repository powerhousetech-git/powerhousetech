"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiSend, useApi } from "@/lib/client";
import type { Template } from "@/lib/types";
import { cn, renderTemplate, truncate } from "@/lib/utils";
import { Button, Card, Skeleton, Toggle } from "@/components/primitives";
import { TemplateEditor, type TemplateDraft } from "@/components/TemplateEditor";

const LANG_STYLES: Record<string, string> = {
  HI: "bg-clay-50 text-clay-600",
  EN: "bg-sky-100 text-sky-700",
  "HI+EN": "bg-amber-500/15 text-amber-600",
};

export default function TemplatesPage() {
  const { data, loading, refetch } = useApi<{ templates: Template[] }>("/api/templates");
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const templates = (data?.templates ?? []).slice().sort(
    (a, b) => Number(a.delay_days) - Number(b.delay_days),
  );

  async function save(draft: TemplateDraft, isNew: boolean) {
    if (isNew) {
      const { template_id, ...rest } = draft;
      await apiSend("/api/templates", "POST", template_id ? draft : rest);
    } else {
      await apiSend("/api/templates", "PUT", draft);
    }
    setCreating(false);
    setEditing(null);
    await refetch();
  }

  async function toggleActive(t: Template) {
    await apiSend("/api/templates", "PUT", { template_id: t.template_id, active: !t.active });
    await refetch();
  }

  async function remove(t: Template) {
    if (!confirm(`Delete ${t.template_id}?`)) return;
    await apiSend(`/api/templates?id=${encodeURIComponent(t.template_id)}`, "DELETE");
    await refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Templates</h1>
          <p className="text-sm text-ink-500">टेम्पलेट · बिना code बदले message edit करें</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.template_id} className={cn("p-4", !t.active && "opacity-70")}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink-900">
                    {t.template_id}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", LANG_STYLES[t.language])}>
                    {t.language}
                  </span>
                </div>
                <Toggle checked={t.active} onChange={() => toggleActive(t)} label="active" />
              </div>

              <p className="min-h-[3rem] whitespace-pre-wrap text-sm text-ink-600">
                {truncate(renderTemplate(t.body, {}), 140)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-sand-100 px-2 py-0.5 font-semibold text-ink-600">
                  Day {t.delay_days} after sale
                </span>
                <span className="rounded-md bg-sand-100 px-2 py-0.5 font-semibold text-ink-600">
                  {t.condition_field
                    ? `When ${t.condition_field} = ${t.condition_value}`
                    : "Always"}
                </span>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" onClick={() => remove(t)} className="text-danger">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateEditor
        open={creating || editing !== null}
        template={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </div>
  );
}
