"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClipboardList, MessageSquareText, History } from "lucide-react";

const reports = [
  {
    title: "Active Brief Summary",
    description:
      "View your current assignments with deliverable details, deadlines, and submission requirements.",
    href: "/partner/reports/active-brief",
    icon: ClipboardList,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Deliverable Feedback",
    description:
      "Review feedback on your deliverables including review comments, approval status, and reviewer notes.",
    href: "/partner/reports/feedback",
    icon: MessageSquareText,
    color: "bg-amber-100 text-amber-600",
  },
  {
    title: "Engagement History",
    description:
      "View all past and current engagements with completion data, performance ratings, and aggregate stats.",
    href: "/partner/reports/history",
    icon: History,
    color: "bg-green-100 text-green-600",
  },
];

export default function PartnerReportsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          View your assignment briefs, deliverable feedback, and engagement
          history
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.map((report) => (
          <Link key={report.href} href={report.href} className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${report.color}`}>
                    <report.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">
                    {report.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
