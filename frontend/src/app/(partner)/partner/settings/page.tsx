"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Bell, Lock, Webhook } from "lucide-react";

const settingsNav = [
  {
    title: "Profile",
    href: "/partner/settings/profile",
    icon: User,
  },
  {
    title: "Notifications",
    href: "/partner/settings/notifications",
    icon: Bell,
  },
  {
    title: "Security",
    href: "/partner/settings/security",
    icon: Lock,
  },
  {
    title: "Webhooks",
    href: "/partner/settings/webhooks",
    icon: Webhook,
  },
];

export default function PartnerSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Sidebar Navigation */}
        <nav className="md:w-48 flex-shrink-0">
          <ul className="flex gap-2 md:flex-col">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
