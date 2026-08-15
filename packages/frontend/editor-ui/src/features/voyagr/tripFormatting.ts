/** Trip budgets are whole-currency amounts — no one budgets a trip to the cent. */
export function formatTripMoney(amount: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency,
		maximumFractionDigits: 0,
	}).format(amount);
}
