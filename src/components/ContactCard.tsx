"use client";

import { useActionState, useState } from "react";
import { Input, Label, Submit } from "@/components/ui";
import { UzPhoneInput } from "@/components/UzPhoneInput";

type Action = (
  prev: { error?: string } | null,
  formData: FormData,
) => Promise<{ error?: string }>;

interface Props {
  action: Action;
  studentId: string;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
}

export function ContactCard({
  action,
  studentId,
  fullName,
  phone,
  parentName,
  parentPhone,
}: Props) {
  const init = {
    fullName,
    phone: phone ?? "",
    parentName: parentName ?? "",
    parentPhone: parentPhone ?? "",
  };

  const [current, setCurrent] = useState(init);
  // After a successful save, the "saved baseline" shifts to what was submitted
  const [baseline, setBaseline] = useState(init);

  const isDirty =
    current.fullName !== baseline.fullName ||
    current.phone !== baseline.phone ||
    current.parentName !== baseline.parentName ||
    current.parentPhone !== baseline.parentPhone;

  const wrappedAction = async (
    prev: { error?: string } | null,
    formData: FormData,
  ): Promise<{ error?: string }> => {
    const result = await action(prev, formData);
    if (!result?.error) {
      setBaseline(current);
    }
    return result ?? {};
  };

  const [state, formAction, pending] = useActionState(wrappedAction, null);

  const set = (field: keyof typeof current) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setCurrent((v) => ({ ...v, [field]: e.target.value }));

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Profile &amp; contact
        </h2>
      </div>
      <div className="px-5 py-5">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="id" value={studentId} />

          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Full name</Label>
            <Input
              name="fullName"
              required
              value={current.fullName}
              onChange={set("fullName")}
              placeholder="Full name"
            />
          </div>

          <div>
            <Label>Student phone</Label>
            <UzPhoneInput
              name="phone"
              defaultValue={current.phone}
              onValueChange={(val) => setCurrent((v) => ({ ...v, phone: val }))}
            />
          </div>
          <div>
            <Label>Parent name</Label>
            <Input
              name="parentName"
              value={current.parentName}
              onChange={set("parentName")}
              placeholder="Full name"
            />
          </div>

          <div>
            <Label>Parent phone</Label>
            <UzPhoneInput
              name="parentPhone"
              defaultValue={current.parentPhone}
              onValueChange={(val) => setCurrent((v) => ({ ...v, parentPhone: val }))}
            />
          </div>

          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            {state?.error && (
              <p className="mr-4 text-sm text-red-600 dark:text-red-400">{state.error}</p>
            )}
            {state && !state.error && !isDirty && (
              <p className="mr-4 text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
            )}
            <Submit variant="orange" disabled={pending || !isDirty}>
              {pending ? "Saving…" : "Save"}
            </Submit>
          </div>
        </form>
      </div>
    </div>
  );
}
