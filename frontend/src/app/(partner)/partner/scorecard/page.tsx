import { ScorecardDashboard } from "@/components/partner/scorecard-dashboard";

export const metadata = {
  title: "Performance Scorecard | AMG Partner Portal",
  description: "View your SLA compliance, quality ratings, response times, and overall performance.",
};

export default function ScorecardPage() {
  return <ScorecardDashboard />;
}
