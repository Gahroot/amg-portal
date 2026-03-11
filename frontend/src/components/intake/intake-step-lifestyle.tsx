"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from "@/types/intake-form";
import type { IntakeFormData } from "@/types/intake-form";

const POPULAR_DESTINATIONS = [
  "Europe",
  "Asia",
  "Middle East",
  "Caribbean",
  "South America",
  "Africa",
  "North America",
  "Oceania",
];

export function IntakeStepLifestyle() {
  const { register, setValue, watch } = useFormContext<IntakeFormData>();
  const preferredDestinations = watch("preferred_destinations") || [];
  const [newDestination, setNewDestination] = React.useState("");

  const addDestination = (destination: string) => {
    if (destination && !preferredDestinations.includes(destination)) {
      setValue("preferred_destinations", [...preferredDestinations, destination]);
    }
    setNewDestination("");
  };

  const removeDestination = (destination: string) => {
    setValue(
      "preferred_destinations",
      preferredDestinations.filter((d) => d !== destination)
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="travel_preferences">Travel Preferences</Label>
          <Textarea
            id="travel_preferences"
            {...register("travel_preferences")}
            placeholder="e.g., Prefers private aviation, luxury hotels, specific airline preferences"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dietary_restrictions">Dietary Restrictions</Label>
          <Textarea
            id="dietary_restrictions"
            {...register("dietary_restrictions")}
            placeholder="e.g., Vegetarian, allergies, religious requirements"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interests">Interests & Hobbies</Label>
        <Textarea
          id="interests"
          {...register("interests")}
          placeholder="e.g., Golf, sailing, art collecting, philanthropy, wine"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Preferred Destinations</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {preferredDestinations.map((dest) => (
            <Badge key={dest} variant="secondary" className="gap-1">
              {dest}
              <button
                type="button"
                onClick={() => removeDestination(dest)}
                className="ml-1 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            placeholder="Add a destination"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDestination(newDestination);
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-muted-foreground mr-2">Quick add:</span>
          {POPULAR_DESTINATIONS.filter((d) => !preferredDestinations.includes(d)).map(
            (dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => addDestination(dest)}
                className="text-xs text-primary hover:underline"
              >
                {dest}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred Language</Label>
        <Select onValueChange={(value) => setValue("language_preference", value)}>
          <SelectTrigger className="w-full md:w-[300px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
