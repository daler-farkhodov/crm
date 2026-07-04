"use client";

import { useEffect, useState } from "react";
import { validateSplit } from "@/lib/payment-split";

const inputCls =
  "w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

type Method = "CASH" | "TRANSFER" | "SPLIT";

/**
 * §3.8: Cash / Transfer / Cash+Transfer control shared by every payment-taking
 * form (invoices, ledger, expenses, teacher payouts). Renders plain named
 * inputs (`paymentMethod`, `cashAmount`, `transferAmount`) so it works inside
 * any <form action={serverAction}> without the parent needing client state —
 * the optional onValidityChange lets a client-component parent block submit
 * on a mismatched split instead of letting the server silently reject it.
 */
export function PaymentMethodFields({
  total,
  onValidityChange,
  className = "",
}: {
  total: number;
  onValidityChange?: (valid: boolean) => void;
  className?: string;
}) {
  const [method, setMethod] = useState<Method>("CASH");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const splitCheck =
    method === "SPLIT" ? validateSplit(total, Number(cashAmount || 0), Number(transferAmount || 0)) : null;

  useEffect(() => {
    onValidityChange?.(method !== "SPLIT" || (splitCheck?.ok ?? false));
  }, [method, splitCheck, onValidityChange]);

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3 text-xs text-slate-700 dark:text-slate-300">
        {(["CASH", "TRANSFER", "SPLIT"] as const).map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="paymentMethod"
              value={opt}
              checked={method === opt}
              onChange={() => setMethod(opt)}
            />
            {opt === "CASH" ? "Cash" : opt === "TRANSFER" ? "Transfer" : "Cash + Transfer"}
          </label>
        ))}
      </div>
      {method === "SPLIT" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            name="cashAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Cash"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            className={inputCls}
          />
          <input
            name="transferAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Transfer"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            className={inputCls}
          />
          {splitCheck && !splitCheck.ok && (
            <span className="text-xs text-red-600 dark:text-red-400">{splitCheck.error}</span>
          )}
        </div>
      )}
    </div>
  );
}
