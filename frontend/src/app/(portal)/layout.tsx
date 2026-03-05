"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { FileText, Home } from "lucide-react";

const navLinks = [
  { href: "/portal/dashboard", label: "Dashboard", icon: Home },
  { href: "/portal/reports", label: "Reports", icon: FileText },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (user && user.role !== "client") {
    router.replace("/");
    return null;
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <nav className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-serif text-xl font-bold tracking-tight">
              AMG Portal
            </span>
            <div className="flex items-center gap-6">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.full_name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </nav>
        <main className="p-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
