"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { ArrowLeft, Star, TrendingUp, Award, Users } from "lucide-react";
import {
  getPartnerScorecard,
  getPartnerPerformanceHistory,
} from "@/lib/api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── helpers ────────────────────────────────────────────────────────────────

function ratingColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  if (score >= 4) return "#16a34a";
  if (score >= 3) return "#d97706";
  return "#dc2626";
}

function ratingLabel(score: number | null): string {
  if (score === null) return "Not rated";
  if (score >= 4.5) return "Exceptional";
  if (score >= 4) return "Excellent";
  if (score >= 3) return "Good";
  if (score >= 2) return "Fair";
  return "Poor";
}

// A single semicircle gauge for a 1–5 score
function RatingGauge({
  score,
  label,
  size = 160,
}: {
  score: number | null;
  label: string;
  size?: number;
}) {
  const pct = score !== null ? ((score - 1) / 4) * 100 : 0;
  const fill = ratingColor(score);
  const data = [{ name: label, value: pct, fill }];

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: size, height: size / 2 + 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="60%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={20}
          >
            {/* background track */}
            <RadialBar
              dataKey="value"
              background={{ fill: "#e2e8f0" }}
              cornerRadius={6}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center -mt-2">
        <p className="text-2xl font-bold" style={{ color: fill }}>
          {score !== null ? score.toFixed(2) : "—"}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function PartnerScorecardPage() {
  const params = useParams();
  const partnerId = params.id as string;

  const { data: scorecard, isLoading: loadingScorecard } = useQuery({
    queryKey: ["partner-scorecard", partnerId],
    queryFn: () => getPartnerScorecard(partnerId),
    enabled: !!partnerId,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["partner-performance-history", partnerId],
    queryFn: () => getPartnerPerformanceHistory(partnerId),
    enabled: !!partnerId,
  });

  const isLoading = loadingScorecard || loadingHistory;

  // Build trend data — one point per rating, labelled by date
  const trendData = history.map((entry, idx) => ({
    label: entry.created_at
      ? format(new Date(entry.created_at), "MMM d")
      : `#${String(idx + 1)}`,
    overall: entry.overall_score,
    quality: entry.quality_score,
    timeliness: entry.timeliness_score,
    communication: entry.communication_score,
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-muted-foreground">Loading scorecard…</p>
        </div>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-muted-foreground">Partner not found.</p>
        </div>
      </div>
    );
  }

  const overallColor = ratingColor(scorecard.avg_overall);

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/partners/${partnerId}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {scorecard.firm_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Partner Scorecard
            </p>
          </div>
          <Badge
            style={{ backgroundColor: overallColor, color: "#fff" }}
            className="text-sm px-3 py-1"
          >
            {ratingLabel(scorecard.avg_overall)}
          </Badge>
        </div>

        {/* Stat summary row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Engagements
                </p>
              </div>
              <p className="text-3xl font-bold">{scorecard.total_ratings}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ratings received
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Completed
                </p>
              </div>
              <p className="text-3xl font-bold">
                {scorecard.completed_assignments}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                assignments done
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Active
                </p>
              </div>
              <p className="text-3xl font-bold">
                {scorecard.active_assignments}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Total
                </p>
              </div>
              <p className="text-3xl font-bold">
                {scorecard.total_assignments}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                all assignments
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rating gauges */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Category Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <RatingGauge
                score={scorecard.avg_overall}
                label="Overall"
                size={160}
              />
              <RatingGauge
                score={scorecard.avg_quality}
                label="Quality"
                size={160}
              />
              <RatingGauge
                score={scorecard.avg_timeliness}
                label="Timeliness"
                size={160}
              />
              <RatingGauge
                score={scorecard.avg_communication}
                label="Communication"
                size={160}
              />
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                ≥ 4.0 Excellent
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                3.0 – 3.9 Good
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                &lt; 3.0 Needs improvement
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Performance trend */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Performance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No rating history yet.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Overall"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="quality"
                      name="Quality"
                      stroke="#16a34a"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone"
                      dataKey="timeliness"
                      name="Timeliness"
                      stroke="#d97706"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone"
                      dataKey="communication"
                      name="Communication"
                      stroke="#0ea5e9"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* legend */}
            {trendData.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0.5 w-5 bg-indigo-500" />
                  Overall
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0.5 w-5 bg-green-600" style={{ borderTop: "2px dashed #16a34a" }} />
                  Quality
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0.5 w-5 bg-amber-500" style={{ borderTop: "2px dashed #d97706" }} />
                  Timeliness
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0.5 w-5 bg-sky-500" style={{ borderTop: "2px dashed #0ea5e9" }} />
                  Communication
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating history table */}
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">
                Engagement History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Overall</TableHead>
                    <TableHead className="text-center">Quality</TableHead>
                    <TableHead className="text-center">Timeliness</TableHead>
                    <TableHead className="text-center">Communication</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.rating_id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {entry.created_at
                          ? format(new Date(entry.created_at), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center font-bold" style={{ color: ratingColor(entry.overall_score) }}>
                        {entry.overall_score}
                      </TableCell>
                      <TableCell className="text-center">{entry.quality_score}</TableCell>
                      <TableCell className="text-center">{entry.timeliness_score}</TableCell>
                      <TableCell className="text-center">{entry.communication_score}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {entry.comments ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
