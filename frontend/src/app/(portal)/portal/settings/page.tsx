"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Bell, Lock } from "lucide-react";

const settingsNav = [
  {
    title: "Profile",
    href: "/portal/settings/profile",
    icon: User,
  },
  {
    title: "Notifications",
    href: "/portal/settings/notifications",
    icon: Bell,
  },
  {
    title: "Security",
    href: "/portal/settings/security",
    icon: Lock,
  },
];

export default function PortalSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl space-y-8 p-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>

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
    </div>
  );
}
