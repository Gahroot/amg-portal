"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckSquare,
  Mail,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsBarProps {
  role: string;
}

export function QuickActionsBar({ role }: QuickActionsBarProps) {
  const isMD = role === "managing_director";
  const isRM = role === "relationship_manager";
  const isCoordinator = role === "coordinator";

  return (
    <div className="flex flex-wrap gap-2">
      {(isMD || isRM || isCoordinator) && (
        <Button size="sm" asChild>
          <Link href="/communications/new">
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            New Communication
          </Link>
        </Button>
      )}
      {(isMD || isRM || isCoordinator) && (
        <Button size="sm" variant="secondary" asChild>
          <Link href="/escalations/new">
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            New Escalation
          </Link>
        </Button>
      )}
      <Button size="sm" variant="outline" asChild>
        <Link href="/approvals">
          <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
          Review Pending
        </Link>
      </Button>
      {(isMD || isRM) && (
        <Button size="sm" variant="outline" asChild>
          <Link href="/programs/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Program
          </Link>
        </Button>
      )}
    </div>
  );
}
