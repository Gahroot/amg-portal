"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  usePortfolioOverview,
  useAnnualReview,
  useExportPortfolio,
  useExportAnnualReview,
} from "@/hooks/use-reports";
import {
  downloadPortfolioPDF,
  downloadAnnualReviewPDF,
} from "@/lib/api/reports";
import {
  ReportFiltersPanel,
  type ReportFilters,
  type ReportType,
} from "@/components/reports/report-filters";
import {
  ReportCard,
  ReportMetric,
  ReportStatusBadge,
} from "@/components/reports/report-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  FileText,
  Download,
  CalendarClock,
  BarChart3,
  TrendingUp,
  Users,
  Star,
  UserCog,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const REPORT_TYPE_INFO: Record<
  ReportType,
  { title: string; icon: React.ReactNode; description: string }
> = {
  portfolio: {
    title: "Portfolio Overview",
    icon: <BarChart3 className="h-5 w-5" />,
    description: "Complete portfolio metrics with program summaries and RAG status",
  },
  program_status: {
    title: "Program Status",
    icon: <TrendingUp className="h-5 w-5" />,
    description: "Detailed status for each active program with milestones",
  },
  completion: {
    title: "Completion Report",
    icon: <FileText className="h-5 w-5" />,
    description: "Post-completion analysis with budget and timeline adherence",
  },
  annual_review: {
    title: "Annual Review",
    icon: <Users className="h-5 w-5" />,
    description: "Year-end review with program trends and partner performance",
  },
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ragColor(rag: string): string {
  switch (rag) {
    case "green":
      return "bg-green-100 text-green-800";
    case "amber":
      return "bg-amber-100 text-amber-800";
    case "red":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function ReportsDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<string>("generate");
  const [filters, setFilters] = React.useState<ReportFilters>({
    reportType: "portfolio",
    startDate: undefined,
    endDate: undefined,
    year: new Date().getFullYear(),
  });
  const [generatedReportType, setGeneratedReportType] =
    React.useState<ReportType | null>(null);

  // Queries — enabled only when a report is generated
  const portfolioQuery = usePortfolioOverview();
  const annualQuery = useAnnualReview(filters.year);

  const { exportPortfolio } = useExportPortfolio();
  const { exportAnnualReview } = useExportAnnualReview();

  const handleGenerate = () => {
    setGeneratedReportType(filters.reportType);
    setActiveTab("results");

    if (filters.reportType === "portfolio") {
      portfolioQuery.refetch();
    } else if (filters.reportType === "annual_review") {
      annualQuery.refetch();
    } else if (filters.reportType === "program_status") {
      // Navigate to program-specific view via programs page
      toast.info("Select a program from the Programs page to view its status report.");
    } else if (filters.reportType === "completion") {
      toast.info("Select a completed program to generate a completion report.");
    }
  };

  const handleExportCSV = async () => {
    try {
      if (generatedReportType === "portfolio") {
        await exportPortfolio();
        toast.success("Portfolio report exported as CSV");
      } else if (generatedReportType === "annual_review") {
        await exportAnnualReview(filters.year);
        toast.success("Annual review exported as CSV");
      }
    } catch {
      toast.error("Failed to export report");
    }
  };

  const handleExportPDF = async () => {
    try {
      if (generatedReportType === "portfolio") {
        await downloadPortfolioPDF();
        toast.success("Portfolio report downloaded as PDF");
      } else if (generatedReportType === "annual_review") {
        await downloadAnnualReviewPDF(filters.year);
        toast.success("Annual review downloaded as PDF");
      }
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const isLoading =
    (generatedReportType === "portfolio" && portfolioQuery.isLoading) ||
    (generatedReportType === "annual_review" && annualQuery.isLoading);

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Reports
            </h1>
            <p className="mt-1 text-muted-foreground">
              Generate and download portfolio reports, program summaries, and
              annual reviews
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/reports/schedules">
              <Button variant="outline" className="gap-2">
                <CalendarClock className="h-4 w-4" />
                Schedules
              </Button>
            </Link>
          </div>
        </div>

        {/* Report Type Quick Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(REPORT_TYPE_INFO) as [ReportType, typeof REPORT_TYPE_INFO.portfolio][]).map(
            ([type, info]) => (
              <Card
                key={type}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  filters.reportType === type
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, reportType: type }))
                }
              >
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    {info.icon}
                  </div>
                  <CardTitle className="text-sm font-medium">
                    {info.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {info.description}
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* Class B — Internal Operational Reports */}
        <div>
          <h2 className="mb-3 font-serif text-lg font-semibold tracking-tight">
            Internal Reports
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/reports/partner-scorecard">
              <Card className="cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Star className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-medium">
                    Partner Scorecard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Quality, timeliness, and SLA metrics per partner
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/reports/rm-portfolio">
              <Card className="cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <UserCog className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-medium">
                    RM Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Client counts, program health, and revenue per RM
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/reports/escalation-log">
              <Card className="cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-medium">
                    Escalation Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Open escalations with owner, level, and age
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/reports/compliance-audit">
              <Card className="cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-medium">
                    Compliance Audit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    KYC document status and access audit summary
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="generate">Configure</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          {/* Configure Tab */}
          <TabsContent value="generate">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <ReportFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onGenerate={handleGenerate}
                  isGenerating={isLoading}
                />
              </div>
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">
                      About This Report
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-primary/10 p-2 text-primary">
                        {REPORT_TYPE_INFO[filters.reportType].icon}
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {REPORT_TYPE_INFO[filters.reportType].title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {REPORT_TYPE_INFO[filters.reportType].description}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-4">
                      <h4 className="mb-2 text-sm font-medium">
                        What&apos;s included:
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {filters.reportType === "portfolio" && (
                          <>
                            <li>• Total and active program counts</li>
                            <li>• Budget overview and status breakdown</li>
                            <li>• RAG status summary across all programs</li>
                            <li>• Milestone progress for each program</li>
                          </>
                        )}
                        {filters.reportType === "program_status" && (
                          <>
                            <li>• Current program RAG status</li>
                            <li>• Active milestones and deliverables</li>
                            <li>• Pending client decisions</li>
                            <li>• Assigned partner information</li>
                          </>
                        )}
                        {filters.reportType === "completion" && (
                          <>
                            <li>• Timeline adherence analysis</li>
                            <li>• Budget vs actual comparison</li>
                            <li>• Milestone completion timeline</li>
                            <li>• Deliverable approval status</li>
                          </>
                        )}
                        {filters.reportType === "annual_review" && (
                          <>
                            <li>• Year-over-year program statistics</li>
                            <li>• Monthly program creation and completion</li>
                            <li>• Partner performance rankings</li>
                            <li>• Total engagement value</li>
                          </>
                        )}
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">CSV Export</Badge>
                      <Badge variant="outline">PDF Download</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            {!generatedReportType ? (
              <Card>
                <CardContent className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      Select a report type and click Generate to view results
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <Card>
                <CardContent className="flex min-h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Generating report...
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Export Buttons */}
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-semibold">
                    {REPORT_TYPE_INFO[generatedReportType].title}
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleExportCSV}
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleExportPDF}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                {/* Portfolio Report Results */}
                {generatedReportType === "portfolio" &&
                  portfolioQuery.data && (
                    <PortfolioReportView data={portfolioQuery.data} />
                  )}

                {/* Annual Review Results */}
                {generatedReportType === "annual_review" &&
                  annualQuery.data && (
                    <AnnualReviewView data={annualQuery.data} />
                  )}

                {/* Program Status / Completion — guidance */}
                {(generatedReportType === "program_status" ||
                  generatedReportType === "completion") && (
                  <Card>
                    <CardContent className="flex min-h-[200px] items-center justify-center">
                      <div className="text-center">
                        <p className="text-muted-foreground">
                          {generatedReportType === "program_status"
                            ? "Program status reports are generated per program."
                            : "Completion reports are generated for completed programs."}
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => router.push("/programs")}
                        >
                          Go to Programs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Portfolio Report View
// ============================================================================

function PortfolioReportView({
  data,
}: {
  data: import("@/lib/api/reports").PortfolioOverviewReport;
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <ReportCard title="Total Programs">
          <ReportMetric label="Programs" value={data.total_programs} />
        </ReportCard>
        <ReportCard title="Active">
          <ReportMetric label="In Progress" value={data.active_programs} />
        </ReportCard>
        <ReportCard title="Completed">
          <ReportMetric label="Finished" value={data.completed_programs} />
        </ReportCard>
        <ReportCard title="Total Budget">
          <ReportMetric
            label="Allocated"
            value={formatCurrency(data.total_budget)}
          />
        </ReportCard>
      </div>

      {/* RAG Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            RAG Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500" />
              <span className="text-sm font-medium">
                Green: {data.rag_summary.green ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-amber-500" />
              <span className="text-sm font-medium">
                Amber: {data.rag_summary.amber ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-red-500" />
              <span className="text-sm font-medium">
                Red: {data.rag_summary.red ?? 0}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Overall Milestone Progress
              </span>
              <span className="font-medium">
                {Math.round(data.overall_milestone_progress)}%
              </span>
            </div>
            <Progress
              value={data.overall_milestone_progress}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Programs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Programs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>RAG</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Milestones</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="font-medium">
                    {program.title}
                  </TableCell>
                  <TableCell>
                    <ReportStatusBadge status={program.status} />
                  </TableCell>
                  <TableCell>
                    <Badge className={ragColor(program.rag_status)}>
                      {program.rag_status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(program.start_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(program.end_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCurrency(program.budget_envelope)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {program.completed_milestone_count}/{program.milestone_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={program.milestone_progress}
                        className="w-16"
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(program.milestone_progress)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.programs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No programs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report Metadata */}
      <p className="text-right text-xs text-muted-foreground">
        Report generated at {formatDate(data.generated_at)}
      </p>
    </div>
  );
}

// ============================================================================
// Annual Review View
// ============================================================================

function AnnualReviewView({
  data,
}: {
  data: import("@/lib/api/reports").AnnualReviewReport;
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <ReportCard title="Total Programs">
          <ReportMetric label={`Year ${data.year}`} value={data.total_programs} />
        </ReportCard>
        <ReportCard title="New Programs">
          <ReportMetric label="Started" value={data.new_programs} />
        </ReportCard>
        <ReportCard title="Completed">
          <ReportMetric label="Finished" value={data.completed_programs} />
        </ReportCard>
        <ReportCard title="Engagement Value">
          <ReportMetric
            label="Total"
            value={formatCurrency(data.total_engagement_value)}
          />
        </ReportCard>
      </div>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>New Programs</TableHead>
                <TableHead>Completed Programs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.programs_by_month.map((month) => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium">
                    {month.month_name}
                  </TableCell>
                  <TableCell>{month.new_programs}</TableCell>
                  <TableCell>{month.completed_programs}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Partner Performance */}
      {data.partner_performance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Partner Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Total Assignments</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Avg Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.partner_performance.map((partner) => (
                  <TableRow key={partner.partner_id}>
                    <TableCell className="font-medium">
                      {partner.firm_name}
                    </TableCell>
                    <TableCell>{partner.total_assignments}</TableCell>
                    <TableCell>{partner.completed_assignments}</TableCell>
                    <TableCell>
                      {partner.avg_performance_rating !== null
                        ? partner.avg_performance_rating.toFixed(1)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Programs List */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Programs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>RAG</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="font-medium">
                    {program.title}
                  </TableCell>
                  <TableCell>
                    <ReportStatusBadge status={program.status} />
                  </TableCell>
                  <TableCell>
                    <Badge className={ragColor(program.rag_status)}>
                      {program.rag_status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(program.start_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(program.end_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCurrency(program.budget_envelope)}
                  </TableCell>
                </TableRow>
              ))}
              {data.programs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No programs found for {data.year}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-right text-xs text-muted-foreground">
        Report generated at {formatDate(data.generated_at)}
      </p>
    </div>
  );
}
