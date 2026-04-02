"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getTopics } from "@/lib/api";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

// Dynamic import for Cytoscape (SSR-incompatible)
let cytoscape: any = null;

export default function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getTopics().then(setTopics).catch(console.error);
    // Load cytoscape dynamically
    import("cytoscape").then((mod) => {
      cytoscape = mod.default;
    });
  }, []);

  const loadGraph = useCallback(async (topicId: string) => {
    if (!topicId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/graph/topic/${topicId}`);
      const data = await res.json();
      setGraphData(data);
      setStats(data.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!graphData || !containerRef.current || !cytoscape) return;

    const elements: any[] = [];

    // Add nodes
    for (const node of graphData.nodes) {
      const size = node.type === "topic" ? 40
        : node.type === "entity" ? 15 + (node.mention_count || 1) * 3
        : 10 + (node.post_count || 1) * 4;

      const color = node.type === "topic" ? "#3b82f6"
        : node.type === "entity" ? "#a855f7"
        : PLATFORM_COLORS[node.platform] || "#6B7280";

      const borderColor = node.avg_sentiment > 0.05 ? SENTIMENT_COLORS.positive
        : node.avg_sentiment < -0.05 ? SENTIMENT_COLORS.negative
        : "#333";

      elements.push({
        group: "nodes",
        data: {
          id: node.id,
          label: node.label,
          ...node,
          nodeSize: Math.min(size, 60),
          nodeColor: color,
          borderColor,
        },
      });
    }

    // Add edges
    for (const edge of graphData.edges) {
      const color = edge.type === "replied_to" ? "#3b82f6"
        : edge.type === "shared_entities" ? "#a855f7"
        : "#333";

      elements.push({
        group: "edges",
        data: {
          source: edge.source,
          target: edge.target,
          ...edge,
          edgeColor: color,
          edgeWidth: Math.min(1 + (edge.weight || 1), 5),
        },
      });
    }

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(nodeColor)",
            "border-color": "data(borderColor)",
            "border-width": 2,
            label: "data(label)",
            "font-size": "9px",
            color: "#ccc",
            "text-valign": "bottom",
            "text-margin-y": 5,
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
          },
        },
        {
          selector: "node[type='topic']",
          style: {
            shape: "diamond",
            "font-size": "12px",
            "font-weight": "bold",
            color: "#fff",
          },
        },
        {
          selector: "node[type='entity']",
          style: {
            shape: "round-rectangle",
            "font-size": "8px",
            color: "#a855f7",
          },
        },
        {
          selector: "edge",
          style: {
            "line-color": "data(edgeColor)",
            width: "data(edgeWidth)",
            "curve-style": "bezier",
            opacity: 0.5,
            "target-arrow-shape": "none",
          },
        },
        {
          selector: "edge[type='replied_to']",
          style: {
            "target-arrow-shape": "triangle",
            "target-arrow-color": "data(edgeColor)",
            "arrow-scale": 0.8,
          },
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#fff",
            "border-width": 3,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 1000,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        gravity: 0.3,
        padding: 40,
      },
      minZoom: 0.2,
      maxZoom: 3,
    });

    // Click handler
    cyRef.current.on("tap", "node", (evt: any) => {
      setSelectedNode(evt.target.data());
    });

    cyRef.current.on("tap", (evt: any) => {
      if (evt.target === cyRef.current) {
        setSelectedNode(null);
      }
    });
  }, [graphData]);

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold">Graph Explorer</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedTopic}
            onChange={(e) => {
              setSelectedTopic(e.target.value);
              loadGraph(e.target.value);
            }}
            className="px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
          >
            <option value="">Select a topic...</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {loading && <span className="text-sm text-[var(--muted)]">Loading...</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-[var(--muted)] shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-500 rounded-full inline-block" /> Topic
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-purple-500 rounded inline-block" /> Entity
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLATFORM_COLORS.youtube }} /> YouTube
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLATFORM_COLORS.reddit }} /> Reddit
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLATFORM_COLORS.hackernews }} /> HN
        </span>
        <span className="text-[var(--border)]">|</span>
        <span>Border: <span style={{ color: SENTIMENT_COLORS.positive }}>positive</span> / <span style={{ color: SENTIMENT_COLORS.negative }}>negative</span></span>
        <span className="text-[var(--border)]">|</span>
        <span>Size = post count</span>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Graph */}
        <div
          ref={containerRef}
          className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl"
          style={{ minHeight: 400 }}
        >
          {!graphData && (
            <div className="flex items-center justify-center h-full text-[var(--muted)]">
              Select a topic to visualize its connection graph
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-72 card shrink-0 overflow-auto">
            <h3 className="font-medium text-sm mb-3">{selectedNode.label}</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Type</span>
                <span className="capitalize">{selectedNode.type}</span>
              </div>
              {selectedNode.platform && selectedNode.platform !== "none" && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Platform</span>
                  <span
                    className="px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${PLATFORM_COLORS[selectedNode.platform] || "#6B7280"}20`,
                      color: PLATFORM_COLORS[selectedNode.platform] || "#6B7280",
                    }}
                  >
                    {selectedNode.platform}
                  </span>
                </div>
              )}
              {selectedNode.post_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Posts</span>
                  <span>{selectedNode.post_count}</span>
                </div>
              )}
              {selectedNode.avg_sentiment !== undefined && selectedNode.avg_sentiment !== 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Avg Sentiment</span>
                  <span
                    style={{
                      color: selectedNode.avg_sentiment > 0.05
                        ? SENTIMENT_COLORS.positive
                        : selectedNode.avg_sentiment < -0.05
                        ? SENTIMENT_COLORS.negative
                        : SENTIMENT_COLORS.neutral,
                    }}
                  >
                    {selectedNode.avg_sentiment.toFixed(3)}
                  </span>
                </div>
              )}
              {selectedNode.total_engagement > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Engagement</span>
                  <span>{selectedNode.total_engagement.toLocaleString()}</span>
                </div>
              )}
              {selectedNode.mention_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Mentions</span>
                  <span>{selectedNode.mention_count}</span>
                </div>
              )}
              {selectedNode.entity_type && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Entity Type</span>
                  <span>{selectedNode.entity_type}</span>
                </div>
              )}
              {selectedNode.last_active && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Last Active</span>
                  <span>{new Date(selectedNode.last_active).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-6 text-xs text-[var(--muted)] shrink-0">
          <span>{stats.total_nodes} nodes</span>
          <span>{stats.total_edges} connections</span>
          <span>{stats.authors} authors</span>
          <span>{stats.entities} entities</span>
        </div>
      )}
    </div>
  );
}
