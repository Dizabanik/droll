
import React from 'react';
import {
  Dices, Plus, Trash2, Sword, Shield,
  ChevronRight, ChevronUp, ChevronDown, Sparkles, Skull, Flame,
  Snowflake, Zap, Droplets, Biohazard,
  Ghost, Sun, Brain, Activity, X, User, Menu,
  RefreshCw, Target, Settings, Check, SlidersHorizontal, Eye, EyeOff,
  Share2, ArrowDownRight, Compass, ShieldAlert, Heart
} from 'lucide-react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export const DualityDiceIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Left D12 - Hope */}
    <g transform="translate(1, 2) scale(0.65)">
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
      <polyline points="12,2 12,12 21,17" />
      <line x1="12" y1="12" x2="3" y2="17" />
      <line x1="12" y1="12" x2="12" y2="22" />
    </g>
    {/* Right D12 - Fear (Interlocked / Overlapping) */}
    <g transform="translate(9, 6) scale(0.65)">
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
      <polyline points="12,2 12,12 21,17" />
      <line x1="12" y1="12" x2="3" y2="17" />
      <line x1="12" y1="12" x2="12" y2="22" />
    </g>
  </svg>
);

export const Icons = {
  Dice: Dices,
  Duality: DualityDiceIcon,
  DualityDice: DualityDiceIcon,
  Add: Plus,
  Delete: Trash2,
  Attack: Sword,
  Defense: Shield,
  ArrowRight: ChevronRight,
  ChevronUp: ChevronUp,
  ChevronDown: ChevronDown,
  Magic: Sparkles,
  Death: Skull,
  Fire: Flame,
  Cold: Snowflake,
  Lightning: Zap,
  Acid: Droplets,
  Poison: Biohazard,
  Necrotic: Ghost,
  Radiant: Sun,
  Psychic: Brain,
  Force: Activity,
  Close: X,
  User: User,
  Menu: Menu,
  Refresh: RefreshCw,
  Target: Target,
  Settings: Settings,
  Check: Check,
  Sliders: SlidersHorizontal,
  Eye: Eye,
  EyeOff: EyeOff,
  Share: Share2,
  ArrowDownRight: ArrowDownRight,
  Compass: Compass,
  ShieldAlert: ShieldAlert,
  Heart: Heart,
};