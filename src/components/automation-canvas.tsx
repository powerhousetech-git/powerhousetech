"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Reveal } from "@/components/ui/reveal";

type WorkflowNodeData = {
  label: string;
  sub: string;
  kind: "trigger" | "ai" | "action" | "logic";
};

const nodeStyles: Record<WorkflowNodeData["kind"], string> = {
  trigger: "workflow-node workflow-node-trigger",
  ai: "workflow-node workflow-node-ai",
  action: "workflow-node workflow-node-action",
  logic: "workflow-node workflow-node-logic",
};

function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  const hasTarget = data.kind !== "trigger";
  const hasSource = data.kind !== "action";

  return (
    <div className={nodeStyles[data.kind]}>
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="workflow-handle"
        />
      )}
      <div className="workflow-node-body">
        <span className="workflow-node-kind">{data.kind}</span>
        <p className="workflow-node-label">{data.label}</p>
        <p className="workflow-node-sub">{data.sub}</p>
      </div>
      {hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="workflow-handle"
        />
      )}
    </div>
  );
}

const initialNodes: Node<WorkflowNodeData>[] = [
  {
    id: "1",
    type: "workflow",
    position: { x: 40, y: 80 },
    data: { label: "New signup", sub: "Webhook · CRM", kind: "trigger" },
  },
  {
    id: "2",
    type: "workflow",
    position: { x: 280, y: 40 },
    data: { label: "Claude classify", sub: "Lead score + intent", kind: "ai" },
  },
  {
    id: "3",
    type: "workflow",
    position: { x: 280, y: 180 },
    data: { label: "IF score > 80", sub: "Branch", kind: "logic" },
  },
  {
    id: "4",
    type: "workflow",
    position: { x: 520, y: 30 },
    data: { label: "HubSpot update", sub: "Deal stage → Demo", kind: "action" },
  },
  {
    id: "5",
    type: "workflow",
    position: { x: 520, y: 160 },
    data: { label: "Slack alert", sub: "#sales-wins", kind: "action" },
  },
  {
    id: "6",
    type: "workflow",
    position: { x: 520, y: 290 },
    data: { label: "Nurture sequence", sub: "Email · 3-step", kind: "action" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3" },
  { id: "e3-4", source: "3", target: "4", label: "yes", animated: true },
  { id: "e3-5", source: "3", target: "5", label: "yes" },
  { id: "e3-6", source: "3", target: "6", label: "no" },
];

export function AutomationCanvas() {
  const nodeTypes = useMemo(() => ({ workflow: WorkflowNode }), []);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...connection, animated: true, style: { stroke: "#2997ff" } },
          eds
        )
      );
    },
    [setEdges]
  );

  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges]
  );

  return (
    <section
      id="playground"
      className="relative border-t border-white/[0.06] py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <Reveal>
          <p className="section-eyebrow">Playground</p>
          <h2 className="section-headline mt-3 max-w-2xl">
            Wire your stack. For real.
          </h2>
          <p className="section-body mt-4 max-w-xl">
            A mini canvas — drag nodes, connect handles. This is a toy preview of
            how we think in n8n. Your production workflows are built for you.
          </p>
          <p className="mt-3 font-mono text-[12px] text-white/35">
            Drag nodes · connect right dot → left dot · double-click edge to remove
          </p>
        </Reveal>

        <Reveal className="mt-10" delay={0.1}>
          <div className="workflow-canvas-shell">
            <div className="workflow-canvas-toolbar">
              <span className="workflow-canvas-dot workflow-canvas-dot-red" />
              <span className="workflow-canvas-dot workflow-canvas-dot-yellow" />
              <span className="workflow-canvas-dot workflow-canvas-dot-green" />
              <span className="ml-3 font-mono text-[11px] text-white/40">
                powerhouse-flow.json · preview
              </span>
            </div>
            <div className="workflow-canvas-wrap">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeDoubleClick={onEdgeDoubleClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.5}
                maxZoom={1.5}
                deleteKeyCode={["Backspace", "Delete"]}
                proOptions={{ hideAttribution: true }}
                className="workflow-flow"
              >
                <Background gap={20} size={1} color="rgba(255,255,255,0.04)" />
                <Controls
                  showInteractive={false}
                  className="workflow-controls"
                />
                <MiniMap
                  className="workflow-minimap"
                  maskColor="rgba(0,0,0,0.7)"
                  nodeColor={() => "#2997ff"}
                />
              </ReactFlow>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
