import {
  Users,
  Shield,
  Lock,
  LayoutDashboard,
  Vote,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import { memo, type CSSProperties, type KeyboardEvent } from 'react'
import { withAlpha, FLOW_NODE_W, FLOW_NODE_H, FLOW_LID_H } from './isoTheme'

const NODE_ICONS: Record<string, LucideIcon> = {
  user: Users,
  login: Lock,
  setup: Shield,
  dashboard: LayoutDashboard,
  vote: Vote,
  result: LinkIcon,
}

export interface FlowNodeData {
  id: string
  label: string
  description: string
  role: string
}

interface IsoNodeProps {
  node: FlowNodeData
  color: string
  isActive: boolean
  left: number
  top: number
  onActivate: () => void
}

/**
 * Satu blok node pada diagram flow.
 * Anchor (left/top) = pojok kiri-atas kartu depan.
 * Lid isometrik digambar di atas kartu sebagai aksen tipis.
 */
const IsoNode = memo(function IsoNode({ node, color, isActive, left, top, onActivate }: IsoNodeProps) {
  const Icon = NODE_ICONS[node.id] || LayoutDashboard

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }

  return (
    <div
      className={`iso-node ${isActive ? 'iso-node--active' : ''}`}
      style={{ left, top, width: FLOW_NODE_W, height: FLOW_NODE_H, '--color': color } as CSSProperties}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-expanded={isActive}
      aria-label={node.label}
    >
      <span
        className="iso-top"
        style={{
          top: -FLOW_LID_H,
          height: FLOW_LID_H,
          background: withAlpha(color, 0.16),
          borderColor: withAlpha(color, 0.3),
        }}
        aria-hidden="true"
      />
      <span className="iso-front">
        <span className="iso-node-icon" style={{ color, background: withAlpha(color, 0.12) }} aria-hidden="true">
          <Icon size={20} strokeWidth={2} />
        </span>
        <span className="iso-node-label">{node.label}</span>
      </span>
    </div>
  )
})
IsoNode.displayName = 'IsoNode'

export default IsoNode
