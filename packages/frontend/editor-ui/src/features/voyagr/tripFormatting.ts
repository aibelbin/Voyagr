/** Trip budgets are whole-currency amounts — no one budgets a trip to the cent. */
export function formatTripMoney(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency,
			maximumFractionDigits: 0,
		}).format(amount);
	} catch {
		// `currency` is Start Trip's raw parameter value — it can be an
		// unresolved expression (`={{ $json.currency }}`), free text pasted into
		// imported workflow JSON, or anything else that isn't a well-formed ISO
		// 4217 code, and `Intl.NumberFormat` throws a `RangeError` for those.
		// Echoing that raw string back onto the canvas would just put the
		// garbage on display, so fall back to a plain number: no symbol, but
		// always legible and never throws.
		return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
	}
}
