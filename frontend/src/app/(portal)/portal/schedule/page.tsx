import { Metadata } from "next";
import { BookMeeting, MyMeetingsList } from "@/components/portal/book-meeting";

export const metadata: Metadata = {
  title: "Schedule a Meeting",
  description: "Book time with your Relationship Manager at a time that works for you.",
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PortalSchedulePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Schedule a Meeting
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Book time with your Relationship Manager at a time that works for you.
        </p>
      </div>

      <Tabs defaultValue="book">
        <TabsList>
          <TabsTrigger value="book">Book a Meeting</TabsTrigger>
          <TabsTrigger value="my">My Meetings</TabsTrigger>
        </TabsList>
        <TabsContent value="book" className="mt-6">
          <BookMeeting />
        </TabsContent>
        <TabsContent value="my" className="mt-6">
          <MyMeetingsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
