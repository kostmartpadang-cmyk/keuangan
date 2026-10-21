import {
  ArrowLeftRight,
  BarChart3,
  Home,
  PiggyBank,
  Settings,
  Target,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: Home },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/budgets", label: "Anggaran", icon: PiggyBank },
  { href: "/planning", label: "Perencanaan", icon: WalletCards },
  { href: "/accounts", label: "Akun uang", icon: Wallet },
  { href: "/goals", label: "Tujuan", icon: Target },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
