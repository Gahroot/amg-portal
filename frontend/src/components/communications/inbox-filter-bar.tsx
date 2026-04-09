"use client";

import { Filter, Mail, MailOpen } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ConversationType } from "@/types/communication";

export type InboxFilter = "all" | "unread";
export type InboxTypeFilter = "all" | ConversationType;

interface InboxFilterBarProps {
  activeFilter: InboxFilter;
  activeTypeFilter: InboxTypeFilter;
  unreadCount: number;
  onFilterChange: (f: InboxFilter) => void;
  onTypeFilterChange: (t: InboxTypeFilter) => void;
}

export function InboxFilterBar({
  activeFilter, activeTypeFilter, unreadCount,
  onFilterChange, onTypeFilterChange,
}: InboxFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      <Toggle
        pressed={activeFilter === "all"}
        onPressedChange={() => onFilterChange("all")}
        size="sm"
        aria-label="Show all conversations"
      >
        <Mail className="h-3.5 w-3.5 mr-1" />
        All
      </Toggle>
      <Toggle
        pressed={activeFilter === "unread"}
        onPressedChange={() => onFilterChange("unread")}
        size="sm"
        aria-label="Show unread conversations"
      >
        <MailOpen className="h-3.5 w-3.5 mr-1" />
        Unread
        {unreadCount > 0 && (
          <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">
            {unreadCount}
          </Badge>
        )}
      </Toggle>
      <div className="flex items-center gap-1.5 ml-auto">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={activeTypeFilter} onValueChange={(v) => onTypeFilterChange(v as InboxTypeFilter)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="coordinator_partner">Coordinator</SelectItem>
            <SelectItem value="rm_client">Client</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
