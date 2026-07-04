"use client";

import { useState } from "react";
import { createExpense } from "@/app/actions/operations";
import { PaymentMethodFields } from "@/components/PaymentMethodFields";
import { Input, Label, Select, Submit } from "@/components/ui";

type Teacher = { id: string; fullName: string };

export function AddExpenseForm({
  teachers,
  labels,
}: {
  teachers: Teacher[];
  labels: {
    titleField: string;
    amount: string;
    date: string;
    teacher: string;
    teacherNone: string;
    deductMonth: string;
    deductYear: string;
    teacherHint: string;
    paymentMethod: string;
    save: string;
  };
}) {
  const [amount, setAmount] = useState("");
  const [valid, setValid] = useState(true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!valid) e.preventDefault();
  }

  return (
    <form action={createExpense} onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <Label>{labels.titleField}</Label>
        <Input name="title" required />
      </div>
      <div>
        <Label>{labels.amount}</Label>
        <Input
          name="amount"
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <Label>{labels.date}</Label>
        <Input name="date" type="date" required />
      </div>
      <div className="md:col-span-2">
        <Label>{labels.teacher}</Label>
        <Select name="teacherId" defaultValue="">
          <option value="">{labels.teacherNone}</option>
          {teachers.map((tc) => (
            <option key={tc.id} value={tc.id}>{tc.fullName}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>{labels.deductMonth}</Label>
        <Input name="deductMonth" type="number" min={1} max={12} />
      </div>
      <div>
        <Label>{labels.deductYear}</Label>
        <Input name="deductYear" type="number" min={2000} max={2100} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 md:col-span-4">{labels.teacherHint}</p>
      <div className="md:col-span-4">
        <Label>{labels.paymentMethod}</Label>
        <PaymentMethodFields total={Number(amount || 0)} onValidityChange={setValid} />
      </div>
      <div className="md:col-span-4">
        <Submit variant="blue" disabled={!valid}>{labels.save}</Submit>
      </div>
    </form>
  );
}
