"use client";

import { useParams, useRouter } from "next/navigation";
import { useAnnualReview, useExportAnnualReview } from "@/hooks/use-reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportContainer, ReportMetric, ReportStatusBadge, ReportCard } from "@/components/reports/report-container";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function AnnualReviewPage() {
  const params = useParams();
  const router = useRouter();
  const year = parseInt(params.year as string);
  const { data: report, isLoading } = useAnnualReview(year);
  const { exportAnnualReview } = useExportAnnualReview();

  const handleExport = () => {
    exportAnnualReview(year);
  };

  const handleYearChange = (delta: number) => {
    const newYear = year + delta;
    router.push(`/portal/reports/annual/${newYear}`);
  };

  if (isLoading) {
    return (
      <ReportContainer title="Annual Review" isLoading>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!report) {
    return (
      <ReportContainer title="Annual Review">
        <p className="text-muted-foreground">Report not found for {year}.</p>
      </ReportContainer>
    );
  }

  return (
    <ReportContainer
      title={`Annual Review — ${year}`}
      subtitle={`Year-in-review across all programs`}
      onExport={handleExport}
    >
      {/* Year Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleYearChange(-1)}
          disabled={year <= 2020}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="font-medium">{year}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleYearChange(1)}
          disabled={year >= new Date().getFullYear()}
        >
          Next
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <ReportMetric label="Total Programs" value={report.total_programs} />
        <ReportMetric label="New Programs" value={report.new_programs} />
        <ReportMetric label="Completed Programs" value={report.completed_programs} />
        <ReportMetric label="Active Programs" value={report.active_programs} />
      </div>

      {/* Engagement Value */}
      {report.total_engagement_value && (
        <ReportCard title="Engagement Value">
          <div className="grid grid-cols-2 gap-6">
            <ReportMetric
              label="Total Engagement Value"
              value={`$${report.total_engagement_value.toLocaleString()}`}
            />
          </div>
        </ReportCard>
      )}

      {/* Programs by Status */}
      <ReportCard title="Programs by Status">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(report.programs_by_status).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between p-3 border rounded-lg">
              <ReportStatusBadge status={status} />
              <span className="font-semibold">{count}</span>
            </div>
          ))}
          {Object.keys(report.programs_by_status).length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">No programs this year</p>
          )}
        </div>
      </ReportCard>

      {/* Monthly Breakdown */}
      <ReportCard title="Monthly Activity">
        {report.programs_by_month.filter((m) => m.new_programs > 0 || m.completed_programs > 0)
          .length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Month</th>
                  <th className="text-left py-3 px-4 font-medium">New Programs</th>
                  <th className="text-left py-3 px-4 font-medium">Completed</th>
                  <th className="text-left py-3 px-4 font-medium">Total Activity</th>
                </tr>
              </thead>
              <tbody>
                {report.programs_by_month.map((month) => {
                  const total = month.new_programs + month.completed_programs;
                  if (total === 0) return null;
                  return (
                    <tr key={month.month} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{month.month_name}</td>
                      <td className="py-3 px-4">{month.new_programs}</td>
                      <td className="py-3 px-4">{month.completed_programs}</td>
                      <td className="py-3 px-4 font-medium">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      {/* Partner Performance */}
      {report.partner_performance.length > 0 && (
        <ReportCard title="Partner Performance">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Firm</th>
                  <th className="text-left py-3 px-4 font-medium">Assignments</th>
                  <th className="text-left py-3 px-4 font-medium">Completed</th>
                  <th className="text-left py-3 px-4 font-medium">Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {report.partner_performance.map((partner) => (
                  <tr key={partner.partner_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{partner.firm_name}</td>
                    <td className="py-3 px-4">{partner.total_assignments}</td>
                    <td className="py-3 px-4">{partner.completed_assignments}</td>
                    <td className="py-3 px-4">
                      {partner.avg_performance_rating !== null ? (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{partner.avg_performance_rating}</span>
                          <span className="text-yellow-500">★</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportCard>
      )}

      {/* All Programs */}
      <ReportCard title={`All Programs (${report.programs.length})`}>
        {report.programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programs this year</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Program</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">RAG</th>
                  <th className="text-left py-3 px-4 font-medium">Timeline</th>
                  <th className="text-left py-3 px-4 font-medium">Budget</th>
                </tr>
              </thead>
              <tbody>
                {report.programs.map((program) => (
                  <tr key={program.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{program.title}</td>
                    <td className="py-3 px-4">
                      <ReportStatusBadge status={program.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            program.rag_status === "green"
                              ? "bg-green-500"
                              : program.rag_status === "amber"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="capitalize text-xs">{program.rag_status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {program.start_date && program.end_date
                        ? `${new Date(program.start_date).toLocaleDateString()} - ${new Date(program.end_date).toLocaleDateString()}`
                        : program.start_date
                        ? `From ${new Date(program.start_date).toLocaleDateString()}`
                        : "Not set"}
                    </td>
                    <td className="py-3 px-4">
                      {program.budget_envelope
                        ? `$${program.budget_envelope.toLocaleString()}`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>
    </ReportContainer>
  );
}
