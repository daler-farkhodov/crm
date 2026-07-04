/**
 * Shared cash/transfer split validation for §3.8: any amount that can be
 * paid partly in cash and partly by transfer must have its two parts sum
 * exactly to the total (to the cent), or the write is rejected outright.
 */
export function validateSplit(
  total: number,
  cash: number,
  transfer: number,
): { ok: true } | { ok: false; error: string } {
  if (Number.isNaN(cash) || Number.isNaN(transfer) || cash < 0 || transfer < 0) {
    return { ok: false, error: "Cash and transfer amounts must be non-negative numbers." };
  }
  const sum = Math.round((cash + transfer) * 100) / 100;
  const rounded = Math.round(total * 100) / 100;
  if (sum !== rounded) {
    return {
      ok: false,
      error: `Cash + Transfer must equal $${rounded.toFixed(2)}, you entered $${sum.toFixed(2)}.`,
    };
  }
  return { ok: true };
}
