/**
 * Projects a Voyagr Itinerary into n8n canvas structures:
 * CanvasNode[] + CanvasConnection[] + CanvasRenderData.
 *
 * Strategy B from the reuse recipe: build CanvasNodeData by hand and a minimal
 * renderData, bypassing n8n's workflow→canvas mapping entirely.
 */
import { ref } from 'vue';
import { NodeConnectionTypes } from 'n8n-workflow';
import {
  type CanvasConnection,
  CanvasConnectionMode,
  type CanvasConnectionPort,
  type CanvasNode,
  type CanvasNodeData,
  CanvasNodeRenderType,
} from '@/features/workflows/canvas/canvas.types';
import {
  createCanvasConnectionHandleString,
  createEmptyCanvasRenderData,
} from '@/features/workflows/canvas/canvas.utils';
import type { Itinerary, TravelActivity, TravelNodeType } from './domain/itinerary';
import { itineraryEdges } from './domain/itinerary';

const COL_W = 360;
const ROW_H = 190;

// n8n's N8nIcon only renders names from its curated allow-list (isSupportedIconName),
// which has no literal travel icons — so map each type to the closest supported name.
// TODO: ship real travel SVGs and switch to icon { type: 'file', src } for branded icons.
const ICON_BY_TYPE: Record<TravelNodeType, string> = {
  flight: 'send',
  intercity_transport: 'waypoints',
  stay: 'house',
  attraction: 'star',
  food: 'pocket-knife',
  experience: 'sparkles',
  free_time: 'sun',
};

const COLOR_BY_TYPE: Record<TravelNodeType, string> = {
  flight: '#2563eb',
  intercity_transport: '#0891b2',
  stay: '#7c3aed',
  attraction: '#db2777',
  food: '#ea580c',
  experience: '#16a34a',
  free_time: '#64748b',
};

function nodeSubtitle(a: TravelActivity): string {
  const parts: string[] = [];
  if (a.cost) {
    if (a.cost.low === 0 && a.cost.high === 0) parts.push('Free');
    else parts.push(`${a.cost.currency} ${a.cost.low}–${a.cost.high}${a.cost.perPerson ? ' pp' : ''}`);
  }
  if (a.subtitle) parts.push(a.subtitle);
  return parts.join(' · ');
}

export function toCanvasNodeData(a: TravelActivity): CanvasNodeData {
  return {
    id: a.id,
    name: a.name,
    subtitle: nodeSubtitle(a),
    type: `voyagr.${a.type}`,
    typeVersion: 1,
    disabled: false,
    connections: {
      [CanvasConnectionMode.Input]: {},
      [CanvasConnectionMode.Output]: {},
    },
    issues: { validation: [], visible: false },
    execution: { running: false },
    runData: { iterations: 0, visible: false },
    render: {
      type: CanvasNodeRenderType.Default,
      options: {
        trigger: false,
        configurable: false,
        configuration: false,
        icon: { type: 'icon', name: ICON_BY_TYPE[a.type], color: COLOR_BY_TYPE[a.type] },
      },
    },
  } as CanvasNodeData;
}

export interface MappedCanvas {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  renderData: ReturnType<typeof createEmptyCanvasRenderData>;
}

export function mapItineraryToCanvas(itinerary: Itinerary): MappedCanvas {
  // Layout: one column per day, activities stacked within a day.
  const indexInDay = new Map<number, number>();
  const nodes: CanvasNode[] = itinerary.activities.map((a) => {
    const row = indexInDay.get(a.day) ?? 0;
    indexInDay.set(a.day, row + 1);
    return {
      id: a.id,
      type: 'canvas-node',
      label: a.name,
      position: { x: (a.day - 1) * COL_W, y: row * ROW_H },
      data: toCanvasNodeData(a),
    } as CanvasNode;
  });

  const port = (index = 0): CanvasConnectionPort => ({
    type: NodeConnectionTypes.Main,
    index,
  });

  const sourceHandle = createCanvasConnectionHandleString({ mode: 'outputs', type: NodeConnectionTypes.Main, index: 0 });
  const targetHandle = createCanvasConnectionHandleString({ mode: 'inputs', type: NodeConnectionTypes.Main, index: 0 });

  const connections: CanvasConnection[] = itineraryEdges(itinerary).map((e) => ({
    id: `[${e.source}/${sourceHandle}][${e.target}/${targetHandle}]`,
    source: e.source,
    target: e.target,
    sourceHandle,
    targetHandle,
    data: {
      source: { ...port(0), node: e.source },
      target: { ...port(0), node: e.target },
    },
  })) as CanvasConnection[];

  // Minimal render data: one main input + one main output handle per node.
  const nodeInputsByNodeId = new Map<string, { value: CanvasConnectionPort[] }>();
  const nodeOutputsByNodeId = new Map<string, { value: CanvasConnectionPort[] }>();
  for (const a of itinerary.activities) {
    nodeInputsByNodeId.set(a.id, ref([port(0)]));
    nodeOutputsByNodeId.set(a.id, ref([port(0)]));
  }

  const renderData = createEmptyCanvasRenderData({
    nodeInputsByNodeId,
    nodeOutputsByNodeId,
  });

  return { nodes, connections, renderData };
}
