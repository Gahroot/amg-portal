import { Metadata } from "next";
import { WhatsNewFeed } from "@/components/portal/whats-new-feed";

export const metadata: Metadata = {
  title: "What's New",
  description: "Latest updates, announcements, and news from your Relationship Manager.",
};

export default function WhatsNewPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <WhatsNewFeed />
    </div>
  );
}
