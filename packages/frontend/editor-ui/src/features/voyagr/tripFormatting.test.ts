import { formatTripMoney } from './tripFormatting';

describe('formatTripMoney', () => {
	it('formats a well-formed ISO currency code', () => {
		expect(formatTripMoney(1000, 'USD')).toBe('$1,000');
	});

	it('falls back to a plain number for a free-text currency', () => {
		// A dropdown value can be overwritten by pasted or imported workflow JSON.
		expect(formatTripMoney(1000, 'US Dollar')).toBe('1,000');
	});

	it('falls back to a plain number for an unresolved expression', () => {
		// n8n allows an expression on any parameter, including a dropdown.
		expect(formatTripMoney(1000, '={{ $json.currency }}')).toBe('1,000');
	});

	it('falls back to a plain number for an empty currency', () => {
		expect(formatTripMoney(1000, '')).toBe('1,000');
	});
});
