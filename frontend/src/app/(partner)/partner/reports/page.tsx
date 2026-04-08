"use client";

import Link from "next/link";
import { FileText, MessageSquare, History, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REPORT_CARDS = [
  {
    title: "Active Brief Summary",
    description:
      "View all your active assignments with task lists, deadlines, submission requirements, and coordinator contact details.",
    href: "/partner/reports/brief-summary",
    icon: FileText,
    color: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Deliverable Feedback",
    description:
      "Review the complete history of your deliverable submissions with review status, reviewer comments, and approval dates.",
    href: "/partner/reports/feedback",
    icon: MessageSquare,
    color: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    title: "Engagement History",
    description:
      "See all past engagements including assignment titles, dates, completion status, deliverable counts, and your performance rating.",
    href: "/partner/reports/history",
    icon: History,
    color: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
];

export default function PartnerReportsIndexPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Access your assignment summaries, feedback history, and engagement records
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.href} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription className="text-sm">{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full gap-2" asChild>
                  <Link href={card.href}>
                    View Report <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
