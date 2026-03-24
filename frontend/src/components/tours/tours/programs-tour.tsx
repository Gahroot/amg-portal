/**
 * Programs Page Tour
 *
 * This tour guides users through the programs listing and management features.
 */

import { FolderKanban } from "lucide-react";
import type { TourDefinition } from "@/lib/tours/config";
import { registerTour } from "@/lib/tours/config";

export const programsTourId = "programs";

export const programsTour: TourDefinition = {
  id: programsTourId,
  name: "Managing Programs",
  description: "Learn how to view, filter, and manage programs",
  category: "pages",
  estimatedTime: "2 min",
  icon: FolderKanban,
  order: 20,
  route: "/programs",
  steps: [
    {
      id: "programs-intro",
      selector: "[data-tour='programs-page']",
      title: "Programs Overview",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            This is the Programs page where you can view and manage all programs.
            Programs are the main container for client engagements.
          </p>
        </div>
      ),
      position: "right",
      padding: 8,
    },
    {
      id: "create-program",
      selector: "[data-tour='create-button']",
      title: "Create New Program",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Click this button to create a new program. You&apos;ll be guided through
            setting up the program details, client assignment, and initial deliverables.
          </p>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "search-programs",
      selector: "[data-tour='search-input']",
      title: "Search Programs",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Use the search to quickly find programs by name, client, or status.
            The search updates results as you type.
          </p>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "filter-programs",
      selector: "[data-tour='filter-button']",
      title: "Filter & Sort",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Use filters to narrow down the program list:
          </p>
          <ul className="list-disc pl-4 text-sm space-y-1 text-muted-foreground">
            <li>Filter by status (Active, Completed, etc.)</li>
            <li>Filter by client</li>
            <li>Filter by assigned partner</li>
            <li>Sort by date, priority, or name</li>
          </ul>
        </div>
      ),
      position: "bottom",
      padding: 8,
    },
    {
      id: "program-table",
      selector: "[data-tour='programs-table']",
      title: "Program List",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            The table shows all programs with key information. Click on any
            row to view the program details and deliverables.
          </p>
        </div>
      ),
      position: "top",
      padding: 8,
    },
    {
      id: "table-actions",
      selector: "[data-tour='table-actions']",
      title: "Row Actions",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Each row has actions like view details, edit, or archive.
            Some actions may be restricted based on your role.
          </p>
        </div>
      ),
      position: "left",
      padding: 8,
    },
    {
      id: "pagination",
      selector: "[data-tour='pagination']",
      title: "Pagination",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            Navigate through pages of results. You can adjust the page size
            in your preferences to show more or fewer items per page.
          </p>
        </div>
      ),
      position: "top",
      padding: 8,
    },
  ],
};

// Auto-register this tour
registerTour(programsTour);
