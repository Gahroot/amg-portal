/**
 * Centralized help content for form fields and UI elements.
 * This file contains all help text definitions to make maintenance easy.
 *
 * @example
 * ```tsx
 * import { fieldHelp } from "@/lib/help-content";
 *
 * <HelpTooltip content={fieldHelp.email.render()}>
 *   <Label>Email</Label>
 * </HelpTooltip>
 * ```
 */

import type { ReactNode } from "react";

/**
 * Structure for field help content
 */
export interface FieldHelpDefinition {
  /** Short description (plain text for simple tooltips) */
  short: string;
  /** Detailed help content (for rich tooltips) */
  detailed?: {
    title?: string;
    body: string;
    items?: readonly string[];
  };
  /** Render method for ReactNode output */
  render?: () => ReactNode;
}

/**
 * Render help content - returns either a string or structured content
 */
function renderHelpContent(help: FieldHelpDefinition): ReactNode {
  if (!help.detailed) {
    return help.short;
  }

  return (
    <div className="space-y-2">
      {help.detailed.title && (
        <p className="font-medium text-foreground">{help.detailed.title}</p>
      )}
      <p>{help.detailed.body}</p>
      {help.detailed.items && help.detailed.items.length > 0 && (
        <ul className="list-disc pl-4 space-y-0.5">
          {help.detailed.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Help content for common form fields
 */
export const fieldHelp = {
  // Authentication & User Fields
  email: {
    short: "We'll use this for account notifications and password recovery.",
    detailed: {
      title: "Email Address",
      body: "Your email is used for:",
      items: [
        "Account notifications",
        "Password recovery",
        "Important updates about your programs",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  password: {
    short: "Must be at least 8 characters with uppercase, lowercase, and numbers.",
    detailed: {
      title: "Password Requirements",
      body: "Your password must include:",
      items: [
        "At least 8 characters",
        "One uppercase letter (A-Z)",
        "One lowercase letter (a-z)",
        "One number (0-9)",
        "Optional: Special characters (!@#$%^&*)",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  confirmPassword: {
    short: "Re-enter your password to confirm it's correct.",
    render() {
      return renderHelpContent(this);
    },
  },

  displayName: {
    short: "This is how your name will appear to other users.",
    render() {
      return renderHelpContent(this);
    },
  },

  phoneNumber: {
    short: "Include country code for international numbers.",
    detailed: {
      title: "Phone Number Format",
      body: "Enter your phone number with country code:",
      items: [
        "US/Canada: +1 555 123 4567",
        "UK: +44 20 1234 5678",
        "Other: +[country code] [number]",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Client & Contact Fields
  clientName: {
    short: "The primary name or title for this client.",
    detailed: {
      body: "This name appears in lists and communications. Use the name the client prefers to be addressed by.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  clientType: {
    short: "Categorize the client for reporting and access control.",
    detailed: {
      title: "Client Types",
      body: "Select the most appropriate category:",
      items: [
        "Individual: Personal services for one person",
        "Family Office: Multi-generational wealth management",
        "Corporate: Business and executive services",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  primaryContact: {
    short: "The main point of contact for this client.",
    render() {
      return renderHelpContent(this);
    },
  },

  // Program & Deliverable Fields
  programName: {
    short: "A descriptive name for this program.",
    detailed: {
      body: "Use a name that clearly identifies the program's purpose and scope. This appears in reports and communications.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  programStatus: {
    short: "Current status of the program.",
    detailed: {
      title: "Status Definitions",
      body: "",
      items: [
        "Draft: Planning phase, not yet active",
        "Active: Currently in progress",
        "On Hold: Temporarily paused",
        "Completed: Successfully finished",
        "Cancelled: Terminated early",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  programPriority: {
    short: "Higher priority programs are highlighted in dashboards.",
    detailed: {
      body: "Priority affects:",
      items: [
        "Dashboard ordering and highlighting",
        "Notification urgency",
        "Report sorting",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  deliverableDueDate: {
    short: "When this deliverable should be completed.",
    detailed: {
      body: "Set realistic deadlines. Late deliverables trigger automatic escalations based on SLA rules.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  deliverableStatus: {
    short: "Current state of this deliverable.",
    detailed: {
      title: "Status Flow",
      body: "",
      items: [
        "Pending: Waiting to start",
        "In Progress: Currently being worked on",
        "Under Review: Awaiting approval",
        "Completed: Finished and approved",
        "Blocked: Cannot proceed (requires attention)",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Partner Fields
  partnerName: {
    short: "The organization or individual partner's name.",
    render() {
      return renderHelpContent(this);
    },
  },

  partnerCapability: {
    short: "Skills and services this partner provides.",
    detailed: {
      body: "Select all capabilities that apply. This determines matching for program assignments.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  partnerCapacity: {
    short: "Current availability for new assignments.",
    detailed: {
      title: "Capacity Levels",
      body: "",
      items: [
        "High: Actively seeking new work",
        "Medium: Accepting select projects",
        "Low: Limited availability",
        "Full: Not accepting new assignments",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  partnerTier: {
    short: "Internal tier rating based on performance and relationship.",
    detailed: {
      body: "Tier affects:",
      items: [
        "Priority in partner matching",
        "Access to premium opportunities",
        "Review frequency",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Document Fields
  documentType: {
    short: "Categorize this document for organization and search.",
    detailed: {
      body: "Common types:",
      items: [
        "Contract: Legal agreements",
        "Report: Analysis and summaries",
        "Presentation: Slides and decks",
        "Financial: Statements and invoices",
        "Identification: ID documents",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  documentExpiry: {
    short: "When this document expires and needs renewal.",
    render() {
      return renderHelpContent(this);
    },
  },

  documentConfidentiality: {
    short: "Access level for this document.",
    detailed: {
      title: "Confidentiality Levels",
      body: "",
      items: [
        "Public: Visible to all users",
        "Internal: Staff only",
        "Confidential: Restricted access",
        "Highly Confidential: Named individuals only",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Notification & Communication Fields
  notificationFrequency: {
    short: "How often you want to receive notification digests.",
    detailed: {
      body: "Choose based on your workflow:",
      items: [
        "Immediate: Get notified right away",
        "Daily Digest: Summary once per day",
        "Weekly Digest: Summary once per week",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  digestFrequency: {
    short: "How often to receive email digests of your activity.",
    render() {
      return renderHelpContent(this);
    },
  },

  reportFormat: {
    short: "Default format for exported reports.",
    detailed: {
      body: "Available formats:",
      items: [
        "PDF: Best for printing and sharing",
        "Excel: Best for data analysis",
        "CSV: Best for importing to other systems",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Date & Time Fields
  dateFormat: {
    short: "How dates should be displayed throughout the application.",
    render() {
      return renderHelpContent(this);
    },
  },

  timeFormat: {
    short: "12-hour (AM/PM) or 24-hour clock.",
    render() {
      return renderHelpContent(this);
    },
  },

  timezone: {
    short: "All times will be shown in this timezone.",
    render() {
      return renderHelpContent(this);
    },
  },

  // Budget & Financial Fields
  budgetAmount: {
    short: "Total allocated budget for this program.",
    render() {
      return renderHelpContent(this);
    },
  },

  currency: {
    short: "Currency for budget and invoice amounts.",
    render() {
      return renderHelpContent(this);
    },
  },

  billingCode: {
    short: "Internal reference code for billing purposes.",
    render() {
      return renderHelpContent(this);
    },
  },

  // Approval & Review Fields
  approvalDueDate: {
    short: "Deadline for this approval decision.",
    detailed: {
      body: "If not approved by this date, the request may be automatically escalated or rejected based on policy.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  approvalComments: {
    short: "Add context for your approval decision.",
    detailed: {
      body: "Comments are visible to the requestor and other approvers. Include reasons for rejection if applicable.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Tags & Categories
  tags: {
    short: "Add tags to organize and filter items.",
    detailed: {
      body: "Tags help you:",
      items: [
        "Group related items together",
        "Filter lists and reports",
        "Search across the system",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  category: {
    short: "Primary category for this item.",
    render() {
      return renderHelpContent(this);
    },
  },

  // Search & Filters
  searchQuery: {
    short: "Search by name, description, or keywords.",
    render() {
      return renderHelpContent(this);
    },
  },

  dateRange: {
    short: "Filter results within this date range.",
    render() {
      return renderHelpContent(this);
    },
  },

  // Settings & Preferences
  language: {
    short: "Preferred display language.",
    render() {
      return renderHelpContent(this);
    },
  },

  theme: {
    short: "Choose your visual theme preference.",
    detailed: {
      body: "Available themes:",
      items: [
        "Light: Bright background",
        "Dark: Dark background (reduces eye strain)",
        "System: Follow your device settings",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  sidebarCollapsed: {
    short: "Collapse the sidebar for more workspace.",
    render() {
      return renderHelpContent(this);
    },
  },

  density: {
    short: "Adjust spacing and information density.",
    detailed: {
      body: "Density options:",
      items: [
        "Comfortable: More spacing, easier to read",
        "Compact: Less spacing, more information visible",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Travel & Scheduling
  travelDates: {
    short: "Select your travel date range.",
    render() {
      return renderHelpContent(this);
    },
  },

  travelDestination: {
    short: "Where you'll be traveling to.",
    render() {
      return renderHelpContent(this);
    },
  },

  meetingAttendees: {
    short: "Add participants to this meeting.",
    detailed: {
      body: "Attendees will receive calendar invitations and meeting notifications.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  // Escalation & SLA
  escalationLevel: {
    short: "Current escalation level of this item.",
    detailed: {
      body: "Levels indicate urgency:",
      items: [
        "Level 1: Standard handling",
        "Level 2: Management attention needed",
        "Level 3: Executive escalation",
      ],
    },
    render() {
      return renderHelpContent(this);
    },
  },

  slaDeadline: {
    short: "Service level agreement deadline.",
    detailed: {
      body: "This deadline is calculated based on SLA rules. Missing it triggers automatic escalation.",
    },
    render() {
      return renderHelpContent(this);
    },
  },
} as const;

/**
 * Help content for UI elements and actions
 */
export const uiHelp = {
  save: {
    short: "Save your changes.",
    render() {
      return this.short;
    },
  },

  cancel: {
    short: "Discard changes and close.",
    render() {
      return this.short;
    },
  },

  reset: {
    short: "Reset to default values.",
    render() {
      return this.short;
    },
  },

  delete: {
    short: "Permanently remove this item.",
    detailed: {
      body: "This action cannot be undone. Related data may also be affected.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  export: {
    short: "Download data in your preferred format.",
    render() {
      return this.short;
    },
  },

  filter: {
    short: "Filter the list based on selected criteria.",
    render() {
      return this.short;
    },
  },

  sort: {
    short: "Change the sort order of the list.",
    render() {
      return this.short;
    },
  },

  bulkEdit: {
    short: "Edit multiple items at once.",
    detailed: {
      body: "Select items using checkboxes, then apply changes to all selected items simultaneously.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  refresh: {
    short: "Reload the latest data.",
    render() {
      return this.short;
    },
  },

  pin: {
    short: "Pin this item to your quick access menu.",
    render() {
      return this.short;
    },
  },

  bookmark: {
    short: "Save this item for later reference.",
    render() {
      return this.short;
    },
  },

  share: {
    short: "Share this item with others.",
    detailed: {
      body: "Create a shareable link or invite specific users to view this item.",
    },
    render() {
      return renderHelpContent(this);
    },
  },

  print: {
    short: "Print or save as PDF.",
    render() {
      return this.short;
    },
  },

  fullscreen: {
    short: "Expand to fullscreen mode.",
    render() {
      return this.short;
    },
  },

  collapse: {
    short: "Collapse this section.",
    render() {
      return this.short;
    },
  },

  expand: {
    short: "Expand this section.",
    render() {
      return this.short;
    },
  },
} as const;

/**
 * Get help content by key path
 * @example
 * getHelp('email') // Returns fieldHelp.email
 * getHelp('ui.save') // Returns uiHelp.save
 */
export function getHelp(path: string): FieldHelpDefinition | undefined {
  const parts = path.split(".");
  if (parts.length === 1) {
    return fieldHelp[parts[0] as keyof typeof fieldHelp];
  }
  if (parts[0] === "ui") {
    return uiHelp[parts[1] as keyof typeof uiHelp] as unknown as FieldHelpDefinition;
  }
  return undefined;
}

/**
 * Type-safe access to field help
 */
export type FieldHelpKey = keyof typeof fieldHelp;
export type UiHelpKey = keyof typeof uiHelp;
