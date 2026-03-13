"use client";

import * as React from "react";
import {
  usePortalIntelligence,
  useUpdatePortalIntelligence,
} from "@/hooks/use-schedules";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function toStringRecord(
  val: unknown,
): Record<string, string> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = typeof v === "string" ? v : JSON.stringify(v ?? "");
    }
    return result;
  }
  return {};
}

export default function PortalPreferencesPage() {
  const { data: intelligence, isLoading } = usePortalIntelligence();
  const updateIntelligence = useUpdatePortalIntelligence();

  // Objectives
  const [goals, setGoals] = React.useState("");
  const [priorities, setPriorities] = React.useState("");
  const [timeline, setTimeline] = React.useState("");

  // Preferences
  const [servicePrefs, setServicePrefs] = React.useState("");
  const [communicationStyle, setCommunicationStyle] = React.useState("");

  // Lifestyle
  const [hobbiesInterests, setHobbiesInterests] = React.useState("");
  const [diningPreferences, setDiningPreferences] = React.useState("");
  const [travelPreferences, setTravelPreferences] = React.useState("");

  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    if (intelligence?.data) {
      const objectives = toStringRecord(intelligence.data.objectives);
      setGoals(objectives.goals ?? "");
      setPriorities(objectives.priorities ?? "");
      setTimeline(objectives.timeline ?? "");

      const preferences = toStringRecord(intelligence.data.preferences);
      setServicePrefs(preferences.service_preferences ?? "");
      setCommunicationStyle(preferences.communication_style ?? "");

      const lifestyle = toStringRecord(intelligence.data.lifestyle_profile);
      setHobbiesInterests(lifestyle.hobbies_interests ?? "");
      setDiningPreferences(lifestyle.dining_preferences ?? "");
      setTravelPreferences(lifestyle.travel_preferences ?? "");

      setHasChanges(false);
    }
  }, [intelligence]);

  const markChanged = () => setHasChanges(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateIntelligence.mutate(
      {
        data: {
          objectives: {
            goals,
            priorities,
            timeline,
          },
          preferences: {
            service_preferences: servicePrefs,
            communication_style: communicationStyle,
          },
          lifestyle_profile: {
            hobbies_interests: hobbiesInterests,
            dining_preferences: diningPreferences,
            travel_preferences: travelPreferences,
          },
        },
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-muted-foreground">Loading your preferences...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          My Preferences
        </h1>
        <p className="mt-1 text-muted-foreground">
          Update your objectives, service preferences, and lifestyle profile.
          Your relationship manager will use these to tailor your experience.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {updateIntelligence.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {updateIntelligence.error instanceof Error
                ? updateIntelligence.error.message
                : "Failed to save preferences"}
            </AlertDescription>
          </Alert>
        )}

        {/* Objectives */}
        <Card>
          <CardHeader>
            <CardTitle>Objectives</CardTitle>
            <CardDescription>
              What are you looking to achieve? Share your goals so we can align
              our services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goals">Goals</Label>
              <Textarea
                id="goals"
                value={goals}
                onChange={(e) => {
                  setGoals(e.target.value);
                  markChanged();
                }}
                placeholder="What are your primary goals..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priorities">Priorities</Label>
              <Textarea
                id="priorities"
                value={priorities}
                onChange={(e) => {
                  setPriorities(e.target.value);
                  markChanged();
                }}
                placeholder="Current priorities and focus areas..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeline">Timeline</Label>
              <Textarea
                id="timeline"
                value={timeline}
                onChange={(e) => {
                  setTimeline(e.target.value);
                  markChanged();
                }}
                placeholder="Key dates, milestones, or timeframes..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Service Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Service Preferences</CardTitle>
            <CardDescription>
              How you like to work with us and what matters most in our service
              delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-prefs">Service Preferences</Label>
              <Textarea
                id="service-prefs"
                value={servicePrefs}
                onChange={(e) => {
                  setServicePrefs(e.target.value);
                  markChanged();
                }}
                placeholder="Preferred service approach, standards, or expectations..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comm-style">Communication Style</Label>
              <Textarea
                id="comm-style"
                value={communicationStyle}
                onChange={(e) => {
                  setCommunicationStyle(e.target.value);
                  markChanged();
                }}
                placeholder="Preferred communication style, frequency, formality..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lifestyle Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Lifestyle Profile</CardTitle>
            <CardDescription>
              Share your interests and preferences to help us personalize
              recommendations and experiences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hobbies">Hobbies & Interests</Label>
              <Textarea
                id="hobbies"
                value={hobbiesInterests}
                onChange={(e) => {
                  setHobbiesInterests(e.target.value);
                  markChanged();
                }}
                placeholder="Sports, arts, collections, activities..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dining">Dining Preferences</Label>
              <Textarea
                id="dining"
                value={diningPreferences}
                onChange={(e) => {
                  setDiningPreferences(e.target.value);
                  markChanged();
                }}
                placeholder="Cuisine preferences, dietary requirements, favorite venues..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="travel-prefs">Travel Preferences</Label>
              <Textarea
                id="travel-prefs"
                value={travelPreferences}
                onChange={(e) => {
                  setTravelPreferences(e.target.value);
                  markChanged();
                }}
                placeholder="Travel style, preferred destinations, accommodation preferences..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!hasChanges || updateIntelligence.isPending}
            size="lg"
          >
            {updateIntelligence.isPending ? "Saving..." : "Save All Preferences"}
          </Button>
        </div>
      </form>
    </div>
  );
}
