import { GitBranch, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDevApi } from '../hooks/useDevApi'
import IsoNode, { type FlowNodeData } from './IsoNode'
import { IsoLoading, IsoError, SectionHeader, LegendItem } from './IsoShared'
import {
  ROLE_COLORS,
  ROLE_LABELS,
  parseRole,
  roleColor,
  FLOW_NODE_W,
  FLOW_NODE_H,
  FLOW_LID_H,
  FLOW_CELL_X,
  FLOW_CELL_Y,
  FLOW_PAD,
  type RoleKey,
} from './isoTheme'

interface FlowNode extends FlowNodeData {
  x: number
  y: number
  edges: string[]
  technical?: string[]
}

interface FlowData {
  flow: FlowNode[]
}

/** Anchor (px) untuk tiap node berdasarkan koordinat grid dari backend. */
function nodePos(n: FlowNode) {
  const col = n.x / 2
  const row = -n.y / 2
  return {
    left: FLOW_PAD + col * FLOW_CELL_X,
    top: FLOW_PAD + FLOW_LID_H + row * FLOW_CELL_Y,
  }
}

interface EdgeLine {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

/**
 * Hitung titik awal/akhir garis antar node, dipotong di tepi kotak node
 * (bukan pusat) supaya panah tidak tertutup kartu — berlaku untuk arah
 * horizontal, vertikal, maupun diagonal.
 */
function buildEdges(nodes: FlowNode[]): EdgeLine[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const lines: EdgeLine[] = []
  const GAP = 10

  for (const src of nodes) {
    const s = nodePos(src)
    for (const targetId of src.edges ?? []) {
      const dst = byId.get(targetId)
      if (!dst) continue
      const d = nodePos(dst)

      const sx = s.left + FLOW_NODE_W / 2
      const sy = s.top + FLOW_NODE_H / 2
      const dx = d.left + FLOW_NODE_W / 2
      const dy = d.top + FLOW_NODE_H / 2

      const vx = dx - sx
      const vy = dy - sy
      const dist = Math.hypot(vx, vy)
      if (dist < 1) continue

      const ux = vx / dist
      const uy = vy / dist

      const sxScale = ux === 0 ? Infinity : FLOW_NODE_W / 2 / Math.abs(ux)
      const syScale = uy === 0 ? Infinity : FLOW_NODE_H / 2 / Math.abs(uy)
      const startScale = Math.min(sxScale, syScale)
      const endScale = Math.min(sxScale, syScale)

      lines.push({
        key: `${src.id}->${targetId}`,
        x1: sx + ux * (startScale + GAP),
        y1: sy + uy * (startScale + GAP),
        x2: dx - ux * (endScale + GAP),
        y2: dy - uy * (endScale + GAP),
        color: roleColor(src.role),
      })
    }
  }
  return lines
}

/** Main IsometricFlow component — visualisasi Flow Aplikasi. */
export default function IsometricFlow() {
  const { data, loading, error, refetch } = useDevApi<FlowData>('/dev/flow')
  const [activeId, setActiveId] = useState<string | null>(null)

  const nodes = useMemo(() => data?.flow ?? [], [data])
  const edges = useMemo(() => buildEdges(nodes), [nodes])
  const activeNode = useMemo(() => nodes.find((n) => n.id === activeId) ?? null, [nodes, activeId])

  const maxCol = nodes.reduce((m, n) => Math.max(m, n.x / 2), 0)
  const maxRow = nodes.reduce((m, n) => Math.max(m, -n.y / 2), 0)
  const canvasW = FLOW_PAD * 2 + maxCol * FLOW_CELL_X + FLOW_NODE_W
  const canvasH = FLOW_PAD * 2 + FLOW_LID_H + maxRow * FLOW_CELL_Y + FLOW_NODE_H

  if (loading) return <IsoLoading message="Memuat visualisasi flow…" />
  if (error) return <IsoError message={error} onRetry={refetch} />

  // Legend hanya menampilkan peran yang benar-benar muncul di diagram.
  const usedRoles = Array.from(new Set(nodes.map((n) => parseRole(n.role)))) as RoleKey[]
  const legend = usedRoles.map((role) => ({
    role,
    label: ROLE_LABELS[role],
  }))

  return (
    <section className="iso-section" aria-labelledby="flow-title">
      <SectionHeader
        icon={GitBranch}
        title="Flow Aplikasi"
        description="Alur lengkap aplikasi TrueCount dari awal hingga akhir. Klik blok untuk melihat detail tiap tahap."
      />

      <div className="iso-canvas-wrap">
        <div className="iso-canvas" style={{ width: canvasW, height: canvasH }}>
          <svg className="iso-edge-layer" width={canvasW} height={canvasH} aria-hidden="true">
            <defs>
              {Object.values(ROLE_COLORS).map((c) => (
                <marker
                  key={c}
                  id={`arrow-${c.replace('#', '')}`}
                  markerWidth="9"
                  markerHeight="7"
                  refX="7"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 9 3.5, 0 7" fill={c} />
                </marker>
              ))}
            </defs>
            {edges.map((e) => (
              <line
                key={e.key}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.color}
                strokeWidth={2}
                strokeLinecap="round"
                markerEnd={`url(#arrow-${e.color.replace('#', '')})`}
              />
            ))}
          </svg>

          {nodes.map((n) => {
            const pos = nodePos(n)
            return (
              <IsoNode
                key={n.id}
                node={n}
                color={roleColor(n.role)}
                isActive={activeId === n.id}
                left={pos.left}
                top={pos.top}
                onActivate={() => setActiveId((prev) => (prev === n.id ? null : n.id))}
              />
            )
          })}
        </div>
      </div>

      {activeNode && (
        <div className="iso-detail-panel" role="region" aria-live="polite">
          <div className="iso-detail-head">
            <h3>{activeNode.label}</h3>
            <span className="iso-badge" style={{ background: roleColor(activeNode.role) }}>
              {ROLE_LABELS[parseRole(activeNode.role)]}
            </span>
            <button
              type="button"
              className="iso-detail-close"
              onClick={() => setActiveId(null)}
              aria-label="Tutup detail"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <p className="iso-detail-text">{activeNode.description}</p>
          {activeNode.technical && activeNode.technical.length > 0 && (
            <div className="iso-detail-tech">
              <span className="iso-detail-tech-label">Detail teknis</span>
              <ul className="iso-detail-tech-list">
                {activeNode.technical.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="iso-legend" role="list" aria-label="Legenda peran">
        {legend.map(({ role, label }) => (
          <LegendItem key={role} color={ROLE_COLORS[role]} label={label} />
        ))}
      </div>
    </section>
  )
}
