/**
 * Voyagr travel domain — pure data, framework-free.
 * Independent of n8n's workflow types; a mapping layer projects this into
 * n8n CanvasNode / CanvasConnection for rendering on the reused n8n canvas.
 */

export type TravelNodeType =
  | 'flight'
  | 'intercity_transport'
  | 'stay'
  | 'attraction'
  | 'food'
  | 'experience'
  | 'free_time';

export interface CostRange {
  low: number;
  high: number;
  currency: string;
  perPerson: boolean;
}

export interface TravelActivity {
  id: string;
  type: TravelNodeType;
  name: string;
  day: number;
  cityId: string;
  cost?: CostRange;
  durationMin?: number;
  subtitle?: string;
}

export interface CitySegment {
  id: string;
  name: string;
  order: number;
}

export interface Itinerary {
  id: string;
  title: string;
  currency: string;
  /** Total budget target for the whole trip, in `currency`. */
  budgetTarget: number;
  /** Number of travelers (multiplies per-person costs). */
  travelers: number;
  cities: CitySegment[];
  activities: TravelActivity[];
}

const EUR = 'EUR';

export function buildSampleItinerary(): Itinerary {
  return {
    id: 'sample-trip',
    title: 'Rome & Florence — 5 Days',
    currency: EUR,
    budgetTarget: 3500,
    travelers: 2,
    cities: [
      { id: 'rome', name: 'Rome', order: 0 },
      { id: 'florence', name: 'Florence', order: 1 },
    ],
    activities: [
      { id: 'arrival', type: 'flight', name: 'Arrive FCO (Rome)', day: 1, cityId: 'rome', cost: { low: 380, high: 520, currency: EUR, perPerson: true }, subtitle: 'Fiumicino Airport' },
      { id: 'hotel-rome', type: 'stay', name: 'Hotel near Termini', day: 1, cityId: 'rome', cost: { low: 110, high: 160, currency: EUR, perPerson: false }, subtitle: '3 nights · Rome' },
      { id: 'colosseum', type: 'attraction', name: 'Colosseum & Forum', day: 1, cityId: 'rome', cost: { low: 18, high: 32, currency: EUR, perPerson: true }, durationMin: 180, subtitle: '3h · must-see' },
      { id: 'dinner-rome', type: 'food', name: 'Trattoria in Monti', day: 1, cityId: 'rome', cost: { low: 25, high: 45, currency: EUR, perPerson: true }, subtitle: 'Dinner' },
      { id: 'vatican', type: 'attraction', name: 'Vatican Museums', day: 2, cityId: 'rome', cost: { low: 20, high: 40, currency: EUR, perPerson: true }, durationMin: 210, subtitle: '3.5h · Sistine Chapel' },
      { id: 'lunch-rome', type: 'food', name: 'Pizza al taglio', day: 2, cityId: 'rome', cost: { low: 8, high: 15, currency: EUR, perPerson: true }, subtitle: 'Lunch' },
      { id: 'trevi', type: 'attraction', name: 'Trevi Fountain', day: 2, cityId: 'rome', cost: { low: 0, high: 0, currency: EUR, perPerson: false }, durationMin: 40, subtitle: 'landmark' },
      { id: 'pantheon', type: 'attraction', name: 'Pantheon', day: 3, cityId: 'rome', cost: { low: 5, high: 5, currency: EUR, perPerson: true }, durationMin: 45, subtitle: 'Landmark' },
      { id: 'train-florence', type: 'intercity_transport', name: 'Train Rome → Florence', day: 3, cityId: 'rome', cost: { low: 25, high: 60, currency: EUR, perPerson: true }, durationMin: 95, subtitle: 'Frecciarossa · 1h35' },
      { id: 'hotel-florence', type: 'stay', name: 'Hotel Santa Maria Novella', day: 4, cityId: 'florence', cost: { low: 120, high: 170, currency: EUR, perPerson: false }, subtitle: '2 nights · Florence' },
      { id: 'uffizi', type: 'attraction', name: 'Uffizi Gallery', day: 4, cityId: 'florence', cost: { low: 26, high: 40, currency: EUR, perPerson: true }, durationMin: 150, subtitle: '2.5h · art' },
      { id: 'dinner-florence', type: 'food', name: 'Bistecca alla Fiorentina', day: 4, cityId: 'florence', cost: { low: 40, high: 70, currency: EUR, perPerson: true }, subtitle: 'Dinner · steak' },
      { id: 'duomo', type: 'attraction', name: "Duomo & Brunelleschi's Dome", day: 5, cityId: 'florence', cost: { low: 20, high: 30, currency: EUR, perPerson: true }, durationMin: 90, subtitle: 'Landmark' },
      { id: 'departure', type: 'flight', name: 'Depart FLR (Florence)', day: 5, cityId: 'florence', cost: { low: 380, high: 520, currency: EUR, perPerson: true }, subtitle: 'Florence Airport' },
    ],
  };
}

export function itineraryEdges(
  itinerary: Itinerary,
): Array<{ id: string; source: string; target: string }> {
  const byDay = new Map<number, TravelActivity[]>();
  for (const a of itinerary.activities) {
    const list = byDay.get(a.day) ?? [];
    list.push(a);
    byDay.set(a.day, list);
  }
  const edges: Array<{ id: string; source: string; target: string }> = [];
  for (const list of byDay.values()) {
    for (let i = 0; i < list.length - 1; i++) {
      edges.push({ id: `${list[i].id}->${list[i + 1].id}`, source: list[i].id, target: list[i + 1].id });
    }
  }
  return edges;
}
