/**
 * Bridges Voyagr travel activities to n8n's node model so we can reuse n8n's
 * real NodeSettings (parameter) panel:
 *  - VOYAGR_NODE_TYPES: synthetic INodeTypeDescription per travel type (seeded
 *    into nodeTypesStore); their `properties` drive n8n's parameter form.
 *  - activityToNode: build an INodeUi for the selected activity (panel input).
 *  - applyParametersToActivity: map edited n8n parameters back to our domain.
 */
import type { INodeProperties, INodeTypeDescription } from 'n8n-workflow';
import type { INodeUi } from '@/Interface';
import type { CostRange, TravelActivity, TravelNodeType } from './domain/itinerary';

const TYPE_LABELS: Record<TravelNodeType, string> = {
  flight: 'Flight',
  intercity_transport: 'Transport',
  stay: 'Stay',
  attraction: 'Attraction',
  food: 'Food',
  experience: 'Experience',
  free_time: 'Free time',
};

// Shared parameter form for every travel node type (flat = always visible).
const PROPERTIES: INodeProperties[] = [
  { displayName: 'Notes', name: 'notes', type: 'string', typeOptions: { rows: 2 }, default: '' },
  { displayName: 'Duration (minutes)', name: 'duration', type: 'number', default: 0 },
  { displayName: 'Cost — low', name: 'costLow', type: 'number', default: 0 },
  { displayName: 'Cost — high', name: 'costHigh', type: 'number', default: 0 },
  {
    displayName: 'Currency',
    name: 'currency',
    type: 'options',
    default: 'EUR',
    options: [
      { name: 'EUR', value: 'EUR' },
      { name: 'USD', value: 'USD' },
      { name: 'GBP', value: 'GBP' },
      { name: 'JPY', value: 'JPY' },
    ],
  },
  { displayName: 'Per person', name: 'perPerson', type: 'boolean', default: false },
];

export const VOYAGR_NODE_TYPES: INodeTypeDescription[] = (
  Object.entries(TYPE_LABELS) as Array<[TravelNodeType, string]>
).map(([type, label]) => ({
  displayName: label,
  name: `voyagr.${type}`,
  group: ['transform'],
  description: `${label} activity`,
  version: 1,
  defaults: { name: label },
  inputs: [],
  outputs: [],
  properties: PROPERTIES,
}));

export function activityToParameters(a: TravelActivity): Record<string, unknown> {
  return {
    notes: a.subtitle ?? '',
    duration: a.durationMin ?? 0,
    costLow: a.cost?.low ?? 0,
    costHigh: a.cost?.high ?? 0,
    currency: a.cost?.currency ?? 'EUR',
    perPerson: a.cost?.perPerson ?? false,
  };
}

export function activityToNode(a: TravelActivity): INodeUi {
  return {
    id: a.id,
    name: a.name,
    type: `voyagr.${a.type}`,
    typeVersion: 1,
    position: [0, 0],
    parameters: activityToParameters(a),
  };
}

/** Map a (possibly partial) n8n parameters object back onto an activity. */
export function applyParametersToActivity(
  a: TravelActivity,
  params: Record<string, unknown>,
): Partial<TravelActivity> {
  const cur: CostRange = a.cost ?? { low: 0, high: 0, currency: 'EUR', perPerson: false };
  const has = (k: string) => params[k] !== undefined;
  return {
    subtitle: has('notes') ? String(params.notes) : a.subtitle,
    durationMin: has('duration') ? Number(params.duration) : a.durationMin,
    cost: {
      low: has('costLow') ? Number(params.costLow) : cur.low,
      high: has('costHigh') ? Number(params.costHigh) : cur.high,
      currency: has('currency') ? String(params.currency) : cur.currency,
      perPerson: has('perPerson') ? Boolean(params.perPerson) : cur.perPerson,
    },
  };
}
