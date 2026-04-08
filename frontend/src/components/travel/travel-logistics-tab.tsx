"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plane, Building2, Car, MapPin, Plus, Pencil, Trash2, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getProgramTravel,
  createTravelBooking,
  updateTravelBooking,
  deleteTravelBooking,
} from "@/lib/api/travel";
import type {
  TravelBooking,
  TravelBookingType,
  TravelBookingStatus,
  TravelBookingCreate,
} from "@/types/travel-booking";

interface TravelLogisticsTabProps {
  programId: string;
}

const BOOKING_TYPE_CONFIG: Record<
  TravelBookingType,
  { icon: React.ElementType; label: string; color: string }
> = {
  flight: { icon: Plane, label: "Flight", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300" },
  hotel: { icon: Building2, label: "Hotel", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300" },
  transfer: { icon: Car, label: "Transfer", color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" },
  venue: { icon: MapPin, label: "Venue", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300" },
};

const STATUS_CONFIG: Record<
  TravelBookingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  confirmed: { label: "Confirmed", variant: "default" },
  pending: { label: "Pending", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  completed: { label: "Completed", variant: "outline" },
};

const BOOKING_TYPES: { value: TravelBookingType; label: string }[] = [
  { value: "flight", label: "Flight" },
  { value: "hotel", label: "Hotel" },
  { value: "transfer", label: "Transfer" },
  { value: "venue", label: "Venue" },
];

const BOOKING_STATUSES: { value: TravelBookingStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BookingCard({
  booking,
  onEdit,
  onDelete,
}: {
  booking: TravelBooking;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const config = BOOKING_TYPE_CONFIG[booking.type];
  const statusConfig = STATUS_CONFIG[booking.status];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`rounded-md p-2 ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{booking.vendor}</CardTitle>
              <p className="text-xs text-muted-foreground">Ref: {booking.booking_ref}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {booking.departure_at && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDateTime(booking.departure_at)}</span>
            </div>
          )}
          {booking.arrival_at && (
            <div className="flex items-center gap-1">
              <span>→</span>
              <span>{formatDateTime(booking.arrival_at)}</span>
            </div>
          )}
        </div>
        {booking.passengers && booking.passengers.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{booking.passengers.join(", ")}</span>
          </div>
        )}
        {booking.details && Object.keys(booking.details).length > 0 && (
          <div className="mt-2 rounded-md bg-muted/50 p-2">
            <pre className="text-xs text-muted-foreground overflow-auto">
              {JSON.stringify(booking.details, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TravelLogisticsTab({ programId }: TravelLogisticsTabProps) {
  const queryClient = useQueryClient();

  const { data: travelData, isLoading } = useQuery({
    queryKey: ["program-travel", programId],
    queryFn: () => getProgramTravel(programId),
  });

  const createMutation = useMutation({
    mutationFn: (data: TravelBookingCreate) => createTravelBooking(programId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-travel", programId] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      bookingId,
      data,
    }: {
      bookingId: string;
      data: Partial<TravelBookingCreate>;
    }) => updateTravelBooking(programId, bookingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-travel", programId] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (bookingId: string) => deleteTravelBooking(programId, bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-travel", programId] });
    },
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBooking, setEditingBooking] = React.useState<TravelBooking | null>(null);
  const [formData, setFormData] = React.useState<TravelBookingCreate>({
    booking_ref: "",
    vendor: "",
    type: "flight",
    departure_at: "",
    arrival_at: "",
    passengers: [],
    status: "confirmed",
  });
  const [passengersInput, setPassengersInput] = React.useState("");

  function resetForm() {
    setFormData({
      booking_ref: "",
      vendor: "",
      type: "flight",
      departure_at: "",
      arrival_at: "",
      passengers: [],
      status: "confirmed",
    });
    setPassengersInput("");
    setEditingBooking(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(booking: TravelBooking) {
    setEditingBooking(booking);
    setFormData({
      booking_ref: booking.booking_ref,
      vendor: booking.vendor,
      type: booking.type,
      departure_at: booking.departure_at?.slice(0, 16) || "",
      arrival_at: booking.arrival_at?.slice(0, 16) || "",
      passengers: booking.passengers || [],
      status: booking.status,
    });
    setPassengersInput((booking.passengers || []).join(", "));
    setDialogOpen(true);
  }

  function handleSubmit() {
    const passengers = passengersInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const data: TravelBookingCreate = {
      ...formData,
      passengers: passengers.length > 0 ? passengers : undefined,
      departure_at: formData.departure_at || undefined,
      arrival_at: formData.arrival_at || undefined,
    };

    if (editingBooking) {
      updateMutation.mutate({ bookingId: editingBooking.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleDelete(booking: TravelBooking) {
    if (confirm(`Delete booking ${booking.booking_ref}?`)) {
      deleteMutation.mutate(booking.id);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Loading itinerary...</p>
      </div>
    );
  }

  const bookings = travelData?.bookings || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBooking ? "Edit Booking" : "Add Booking"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: TravelBookingType) =>
                    setFormData((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  value={formData.vendor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vendor: e.target.value }))
                  }
                  placeholder="e.g., British Airways, Four Seasons"
                />
              </div>
              <div className="space-y-2">
                <Label>Booking Reference</Label>
                <Input
                  value={formData.booking_ref}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, booking_ref: e.target.value }))
                  }
                  placeholder="e.g., BA123456"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departure / Start</Label>
                  <Input
                    type="datetime-local"
                    value={formData.departure_at}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, departure_at: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Arrival / End</Label>
                  <Input
                    type="datetime-local"
                    value={formData.arrival_at}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, arrival_at: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Passengers (comma-separated)</Label>
                <Input
                  value={passengersInput}
                  onChange={(e) => setPassengersInput(e.target.value)}
                  placeholder="e.g., John Smith, Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TravelBookingStatus) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={
                  !formData.booking_ref ||
                  !formData.vendor ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingBooking
                    ? "Update"
                    : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Plane className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No travel bookings yet. Add flight, hotel, transfer, or venue bookings
              to build the program itinerary.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onEdit={() => openEditDialog(booking)}
              onDelete={() => handleDelete(booking)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
