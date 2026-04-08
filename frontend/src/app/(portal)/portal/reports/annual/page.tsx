import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Annual Reviews",
  description: "Access your annual performance and portfolio review reports.",
};
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, TrendingUp, Users, BarChart3, Map } from "lucide-react";

export default function AnnualReviewIndexPage() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Annual Relationship Review</h1>
        <p className="text-muted-foreground mt-2">
          A comprehensive year-in-review covering all programs, relationship depth metrics, and
          your strategic roadmap for the year ahead.
        </p>
      </div>

      {/* What's included */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">What This Report Contains</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex gap-3">
              <div className="mt-0.5 flex-shrink-0 rounded-md bg-primary/10 p-2">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Program Summary</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All programs active, completed, or initiated during the year with status and
                  budget detail.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 flex-shrink-0 rounded-md bg-primary/10 p-2">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Relationship Depth Metrics</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Engagement value, activity trends by month, and year-over-year trajectory.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 flex-shrink-0 rounded-md bg-primary/10 p-2">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Partner Performance</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assignment completion rates and ratings across all partner firms engaged.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 flex-shrink-0 rounded-md bg-primary/10 p-2">
                <Map className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Strategic Roadmap</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Forward-looking view of programs and priorities planned for the year ahead.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Year selection */}
      <div>
        <h2 className="font-serif text-xl font-semibold mb-4">Select a Year</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {years.map((year) => {
            const isCurrent = year === currentYear;
            return (
              <Link key={year} href={`/portal/reports/annual/${year}`} className="group">
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="rounded-md bg-muted p-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="font-serif text-2xl group-hover:text-primary transition-colors">
                      {year}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-4">
                      {isCurrent
                        ? "Year-to-date review across all active and completed programs."
                        : `Full-year review for ${year} across all programs and partners.`}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between px-0 group-hover:text-primary"
                      asChild
                    >
                      <span>
                        View Report
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
