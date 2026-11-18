import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Check,
  CircleX,
  Code,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  GraduationCap,
  Info,
  Link,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Plus,
  Settings,
  Shield,
  TriangleAlert,
  User,
  Users,
  Usb,
  Vote,
  X,
} from 'lucide-react'

/* Pemetaan nama ikon aplikasi → komponen lucide (outline, tengah kosong).
   Satu sumber kebenaran agar seluruh halaman konsisten. */
const ICONS = {
  alert: TriangleAlert,
  arrow: ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  award: Award,
  ballot: Vote,
  chart: BarChart3,
  chain: Link,
  check: Check,
  code: Code,
  copy: Copy,
  eye: Eye,
  'eye-off': EyeOff,
  fingerprint: Fingerprint,
  info: Info,
  lock: Lock,
  login: LogIn,
  logout: LogOut,
  mail: Mail,
  menu: Menu,
  plus: Plus,
  revoke: CircleX,
  school: GraduationCap,
  settings: Settings,
  shield: Shield,
  user: User,
  users: Users,
  usb: Usb,
  vote: Vote,
  close: X,
  x: X,
}

/**
 * Ikon terpusat berbasis lucide-react.
 * Default outline (tengah kosong) dengan stroke 1.5 agar seragam.
 *
 * @param {string} name  kunci dari ICONS (mis. 'lock', 'arrow-left')
 * @param {number} size  ukuran px (default 20)
 * @param {number} strokeWidth ketebalan garis (default 1.5)
 * @param {object} props  diteruskan ke svg (mis. className)
 */
export default function Icon({ name, size = 20, strokeWidth = 1.5, ...props }) {
  const LucideIcon = ICONS[name]
  if (!LucideIcon) {
    console.warn(`[Icon] ikon "${name}" tidak dikenal`)
    return null
  }
  return <LucideIcon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />
}
