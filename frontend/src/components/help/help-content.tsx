"use client";

import {
  HelpCircle,
  BookOpen,
  PlayCircle,
  ExternalLink,
  MessageCircle,
  FileText,
  ListChecks,
  Lightbulb,
} from "lucide-react";

export interface HelpArticle {
  id: string;
  title: string;
  description?: string;
  type: "guide" | "article" | "video" | "faq";
  url?: string;
  videoId?: string;
  duration?: string;
}

export interface HelpSection {
  title: string;
  icon?: typeof HelpCircle;
  articles: HelpArticle[];
}

export interface PageHelpContent {
  /** Page title for the help panel header */
  title: string;
  /** Brief overview of the page */
  overview: string;
  /** Quick tips for the page */
  quickTips?: string[];
  /** Help sections with articles */
  sections: HelpSection[];
  /** Related articles from other pages */
  relatedArticles?: HelpArticle[];
  /** External documentation URL */
  docsUrl?: string;
}

/**
 * Help content for each page type
 */
const helpContentMap: Record<string, PageHelpContent> = {
  dashboard: {
    title: "Dashboard",
    overview:
      "Your central hub for monitoring key metrics, recent activity, and upcoming tasks across all programs and clients.",
    quickTips: [
      "Use the command palette (Cmd+K) to quickly navigate to any page",
      "Click on metric cards to drill down into detailed views",
      "Pin frequently accessed items for quick access",
    ],
    sections: [
      {
        title: "Getting Started",
        icon: BookOpen,
        articles: [
          {
            id: "dashboard-overview",
            title: "Dashboard Overview",
            description: "Learn about the dashboard layout and key features",
            type: "guide",
          },
          {
            id: "dashboard-metrics",
            title: "Reading Dashboard Metrics",
            description: "Understand what each metric card shows",
            type: "article",
          },
        ],
      },
      {
        title: "Video Tutorials",
        icon: PlayCircle,
        articles: [
          {
            id: "dashboard-tour",
            title: "Dashboard Tour",
            description: "5-minute walkthrough of all features",
            type: "video",
            videoId: "dashboard-tour",
            duration: "5:00",
          },
        ],
      },
    ],
    relatedArticles: [
      {
        id: "notifications-setup",
        title: "Setting Up Notifications",
        type: "article",
      },
    ],
    docsUrl: "/api/v1/docs",
  },

  clients: {
    title: "Clients",
    overview:
      "Manage your client database, view client profiles, track relationships, and maintain client documentation.",
    quickTips: [
      "Use filters to find clients by status, relationship manager, or tags",
      "Bulk actions let you update multiple clients at once",
      "Star important clients to add them to your favorites",
    ],
    sections: [
      {
        title: "Managing Clients",
        icon: ListChecks,
        articles: [
          {
            id: "add-client",
            title: "Adding a New Client",
            description: "Step-by-step guide to client onboarding",
            type: "guide",
          },
          {
            id: "client-profile",
            title: "Understanding Client Profiles",
            description: "Navigate client details and history",
            type: "article",
          },
          {
            id: "family-members",
            title: "Managing Family Members",
            description: "Add and organize family relationships",
            type: "article",
          },
        ],
      },
      {
        title: "Best Practices",
        icon: Lightbulb,
        articles: [
          {
            id: "client-segmentation",
            title: "Client Segmentation Strategy",
            description: "Organize clients effectively",
            type: "article",
          },
        ],
      },
    ],
    docsUrl: "/api/v1/docs",
  },

  partners: {
    title: "Partners",
    overview:
      "Manage partner organizations, track performance metrics, and coordinate service delivery.",
    quickTips: [
      "View partner performance scores in the analytics tab",
      "Set up automated notifications for partner updates",
      "Track partner certifications and compliance status",
    ],
    sections: [
      {
        title: "Partner Management",
        icon: BookOpen,
        articles: [
          {
            id: "add-partner",
            title: "Adding a New Partner",
            description: "Onboard partner organizations",
            type: "guide",
          },
          {
            id: "partner-performance",
            title: "Understanding Partner Scores",
            description: "How performance metrics are calculated",
            type: "article",
          },
        ],
      },
    ],
    docsUrl: "/api/v1/docs",
  },

  programs: {
    title: "Programs",
    overview:
      "Create and manage programs for clients, track milestones, and coordinate deliverables across teams.",
    quickTips: [
      "Use the timeline view to visualize program progress",
      "Set up milestone reminders to stay on track",
      "Clone existing programs as templates for new ones",
    ],
    sections: [
      {
        title: "Program Setup",
        icon: ListChecks,
        articles: [
          {
            id: "create-program",
            title: "Creating a Program",
            description: "Step-by-step program creation",
            type: "guide",
          },
          {
            id: "program-templates",
            title: "Using Program Templates",
            description: "Save time with reusable templates",
            type: "article",
          },
          {
            id: "milestones",
            title: "Setting Milestones",
            description: "Define key program checkpoints",
            type: "article",
          },
        ],
      },
      {
        title: "Program Execution",
        icon: PlayCircle,
        articles: [
          {
            id: "program-workflow",
            title: "Program Workflow",
            description: "8-minute deep dive",
            type: "video",
            videoId: "program-workflow",
            duration: "8:00",
          },
        ],
      },
    ],
    docsUrl: "/api/v1/docs",
  },

  tasks: {
    title: "Task Board",
    overview:
      "View and manage tasks across all programs, assign team members, and track completion status.",
    quickTips: [
      "Drag and drop tasks between status columns",
      "Use quick filters to focus on your assignments",
      "Set due dates and priority levels for better organization",
    ],
    sections: [
      {
        title: "Task Management",
        icon: ListChecks,
        articles: [
          {
            id: "task-basics",
            title: "Task Board Basics",
            description: "Navigate and use the task board",
            type: "guide",
          },
          {
            id: "task-assignment",
            title: "Assigning Tasks",
            description: "Delegate work to team members",
            type: "article",
          },
        ],
      },
    ],
    docsUrl: "/api/v1/docs",
  },

  approvals: {
    title: "Approvals",
    overview:
      "Review and process approval requests for budgets, deliverables, and other items requiring authorization.",
    quickTips: [
      "Enable email notifications for urgent approvals",
      "Use bulk approve for routine items",
      "Add comments to explain rejection reasons",
    ],
    sections: [
      {
        title: "Approval Process",
        icon: ListChecks,
        articles: [
          {
            id: "approval-workflow",
            title: "Approval Workflow Guide",
            description: "How the approval process works",
            type: "guide",
          },
          {
            id: "delegation",
            title: "Delegating Approvals",
            description: "Set up approval delegation",
            type: "article",
          },
        ],
      },
    ],
    docsUrl: "/api/v1/docs",
  },

  settings: {
    title: "Settings",
    overview:
      "Configure your account preferences, notification settings, and system configurations.",
    quickTips: [
      "Set up two-factor authentication for added security",
      "Configure notification preferences to stay informed",
      "Review your active sessions under security settings",
    ],
    sections: [
      {
        title: "Account Settings",
        icon: BookOpen,
        articles: [
          {
            id: "profile-settings",
            title: "Profile Settings",
            description: "Update your personal information",
            type: "article",
          },
          {
            id: "security-settings",
            title: "Security Settings",
            description: "Manage passwords and 2FA",
            type: "article",
          },
          {
            id: "notification-prefs",
            title: "Notification Preferences",
            description: "Customize how you receive alerts",
            type: "article",
          },
        ],
      },
    ],
    docsUrl: "/api/v1/docs",
  },
};

/**
 * Default help content for pages without specific content
 */
const defaultHelpContent: PageHelpContent = {
  title: "Help Center",
  overview: "Find answers to common questions and learn how to use the platform effectively.",
  sections: [
    {
      title: "Getting Help",
      icon: HelpCircle,
      articles: [
        {
          id: "getting-started",
          title: "Getting Started Guide",
          description: "New to the platform? Start here",
          type: "guide",
        },
        {
          id: "keyboard-shortcuts",
          title: "Keyboard Shortcuts",
          description: "Work faster with keyboard navigation",
          type: "article",
        },
      ],
    },
  ],
  docsUrl: "/api/v1/docs",
};

/**
 * Get help content for a specific page type
 */
export function getHelpContent(pageType: string): PageHelpContent {
  return helpContentMap[pageType] || { ...defaultHelpContent, title: formatPageTitle(pageType) };
}

/**
 * Search help articles across all pages
 */
export function searchHelpContent(query: string): HelpArticle[] {
  const results: HelpArticle[] = [];
  const lowerQuery = query.toLowerCase();

  Object.values(helpContentMap).forEach((content) => {
    content.sections.forEach((section) => {
      section.articles.forEach((article) => {
        if (
          article.title.toLowerCase().includes(lowerQuery) ||
          article.description?.toLowerCase().includes(lowerQuery)
        ) {
          results.push(article);
        }
      });
    });
    content.relatedArticles?.forEach((article) => {
      if (
        article.title.toLowerCase().includes(lowerQuery) ||
        article.description?.toLowerCase().includes(lowerQuery)
      ) {
        results.push(article);
      }
    });
  });

  return results;
}

/**
 * Get icon component for article type
 */
export function getArticleIcon(type: HelpArticle["type"]): typeof HelpCircle {
  const icons: Record<string, typeof HelpCircle> = {
    guide: ListChecks,
    article: FileText,
    video: PlayCircle,
    faq: HelpCircle,
  };
  return icons[type] || FileText;
}

/**
 * Format page type to readable title
 */
function formatPageTitle(pageType: string): string {
  return pageType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Common help actions available on all pages
 */
export const commonHelpActions = [
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    description: "View all available shortcuts",
    icon: null as unknown as typeof HelpCircle,
  },
  {
    id: "contact-support",
    title: "Contact Support",
    description: "Get help from our team",
    icon: MessageCircle,
  },
  {
    id: "view-docs",
    title: "Full Documentation",
    description: "Browse complete documentation",
    icon: ExternalLink,
  },
];
