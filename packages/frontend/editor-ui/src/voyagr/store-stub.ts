/**
 * Minimal fake WorkflowDocumentStore.
 *
 * Provided via WorkflowDocumentStoreKey in an ancestor so n8n's Canvas AND
 * NodeSettings/NDV resolve it (instead of n8n's global workflow store). It
 * bridges n8n's node-parameter edits back into the Voyagr trip store:
 *  - getNodeByName -> build an INodeUi from the matching activity
 *  - setNodeParameters -> map edited params back onto the activity
 *
 * A Proxy returns a no-op for any member we didn't explicitly implement, so an
 * unforeseen method call degrades gracefully instead of throwing mid-render.
 */
import type { INodeUi, IUpdateInformation } from '@/Interface';
import type { WorkflowDocumentStore } from '@/app/stores/workflowDocument.store';
import { useVoyagrTripStore } from './trip.store';
import { activityToNode, applyParametersToActivity } from './voyagr-nodes';

export function makeFakeWorkflowDocumentStore(): WorkflowDocumentStore {
  const trip = useVoyagrTripStore();
  const activityByName = (name: string) => trip.itinerary.activities.find((a) => a.name === name);
  const nodeByName = (name: string): INodeUi | null => {
    const a = activityByName(name);
    return a ? activityToNode(a) : null;
  };

  const base: Record<string, unknown> = {
    // identity / collections (properties)
    documentId: 'voyagr@latest',
    workflowId: 'voyagr',
    name: 'Voyagr Trip',
    active: false,
    isArchived: false,
    homeProject: undefined,
    settings: {},
    usedCredentials: {},
    pinnedDataByNodeName: {},
    allNodes: [],
    allGroups: [],
    nodeIdToGroupId: new Map<string, string>(),
    connectionsBySourceNode: {},
    connectionsByDestinationNode: {},
    workflowTriggerNodes: [],

    // node lookups
    getNodeById: (_id: string) => undefined,
    getNodeByName: (name: string) => nodeByName(name),
    getGroupById: (_id: string) => undefined,
    getGroupForNode: (_id: string) => undefined,
    getParentNodes: (_name: string) => [],
    getChildNodes: (_name: string) => [],
    getParentNodesByDepth: (_id?: string) => [],
    getNextDefaultName: (name: string) => name,
    getNodePinData: (_name: string) => undefined,
    outgoingConnectionsByNodeName: (_name: string) => ({}),
    checkIfNodeHasChatOrManualChatParent: (_name: string) => false,
    findRootWithMainConnection: (_name: string) => undefined,
    getWorkflowObjectAccessorSnapshot: () => ({}),
    getExpressionHandler: () => undefined,

    // pristine / issues
    isNodePristine: (_name: string) => true,
    setNodePristine: (_name: string, _pristine: boolean) => {},
    setNodeIssue: (_issue: unknown) => {},

    // parameter edits from NodeSettings -> travel domain
    setNodeParameters: (info: IUpdateInformation) => {
      const a = activityByName(info.name);
      if (a) trip.updateActivity(a.id, applyParametersToActivity(a, info.value as Record<string, unknown>));
    },
    setNodeValue: (info: IUpdateInformation) => {
      if (info.key === 'notes') {
        const a = activityByName(info.name);
        if (a) trip.updateActivity(a.id, { subtitle: String(info.value ?? '') });
      }
    },
    updateNodeProperties: (_info: unknown) => {},

    // canvas-only / inert
    setNodePositionById: (_id: string, _pos: [number, number]) => {},
    setConnections: (_connections: unknown) => {},
    updateName: (_id: string, _name: string) => {},
    updateDescription: (_id: string, _description: string) => {},
    createGroup: (..._args: unknown[]) => undefined,
    addNodesToGroup: (..._args: unknown[]) => {},
    onNodeGroupsChange: (_handler: (...args: unknown[]) => void) => () => {},
  };

  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      // Never fake Vue-internal/reactivity or thenable probes.
      if (typeof prop === 'symbol' || prop === 'then' || String(prop).startsWith('__')) {
        return undefined;
      }
      // Unknown member: assume it's a method and no-op it.
      return () => undefined;
    },
  });

  return proxy as unknown as WorkflowDocumentStore;
}
