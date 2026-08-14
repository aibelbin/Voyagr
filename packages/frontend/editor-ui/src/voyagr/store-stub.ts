/**
 * Minimal fake WorkflowDocumentStore.
 *
 * Canvas.vue and the node/toolbar components call injectWorkflowDocumentStore()
 * internally; providing this fake under WorkflowDocumentStoreKey in an ancestor
 * keeps them from reading n8n's global workflow store. Implements (as inert
 * no-ops) every member the canvas + node-render path touches.
 */
import type { WorkflowDocumentStore } from '@/app/stores/workflowDocument.store';

export function makeFakeWorkflowDocumentStore(): WorkflowDocumentStore {
  const fake = {
    // identity / collections
    documentId: 'travel@latest',
    workflowId: 'travel',
    allNodes: [],
    connectionsBySourceNode: {},
    allGroups: [],
    nodeIdToGroupId: new Map<string, string>(),

    // lookups (node-render path)
    getNodeById: (_id: string) => undefined,
    getNodeByName: (_name: string) => undefined,
    getGroupById: (_id: string) => undefined,
    getGroupForNode: (_id: string) => undefined,
    getParentNodesByDepth: (_id?: string) => [],
    getNextDefaultName: (name: string) => name,

    // mutations (interaction) — inert for a read-only sample
    setNodePositionById: (_id: string, _pos: [number, number]) => {},
    setConnections: (_connections: unknown) => {},
    updateName: (_id: string, _name: string) => {},
    updateDescription: (_id: string, _description: string) => {},
    createGroup: (..._args: unknown[]) => undefined,
    addNodesToGroup: (..._args: unknown[]) => {},

    // subscriptions
    onNodeGroupsChange: (_handler: (...args: unknown[]) => void) => () => {},
  };
  return fake as unknown as WorkflowDocumentStore;
}
