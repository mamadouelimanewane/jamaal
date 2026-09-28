/**
 * Patch pour src/app/(admin)/admin/(dashboard)/layout.tsx
 *
 * Ajouter MessageCircle et BookOpen dans les imports lucide.
 * Remplacer consultantLinks par :
 */

import { LayoutDashboard, ShoppingCart, MessageCircle, BookOpen, Bell } from "lucide-react";

export const consultantLinksPatched = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
  { href: "/admin/outils", label: "Outils de vente", icon: MessageCircle },
  { href: "/admin/formation", label: "Formation", icon: BookOpen },
];

/*
{role === "CONSULTANT" && (
  <div className="flex flex-col gap-0.5">
    {consultantLinksPatched.map((l) => (
      <SidebarNavLink key={l.href} href={l.href} label={l.label} icon={<l.icon size={16} />} />
    ))}
    <SidebarNavLink
      href="/admin/notifications"
      label="Notifications"
      icon={<Bell size={16} />}
      badge={unreadCount}
    />
  </div>
)}
*/
