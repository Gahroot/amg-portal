"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileForm } from "@/components/settings/profile-form";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { SecuritySettingsForm } from "@/components/settings/security-settings-form";
import { MessageDigestPreferences } from "@/components/settings/message-digest-preferences";
import { GranularNotificationPreferences } from "@/components/settings/granular-notification-preferences";
import { APIKeysManager } from "@/components/settings/api-keys-manager";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import { User, Bell, Lock, Settings2, Palette, Sun, Moon, Monitor, Key, Calendar, Plug, Contrast } from "lucide-react";
import { useTheme } from "next-themes";
import { useHighContrast } from "@/components/ui/theme-toggle";
import { Balancer } from "react-wrap-balancer";

export default function SettingsPage() {
  const { user } = useAuth();
  const { setTheme, theme } = useTheme();
  const { highContrast, setHighContrast } = useHighContrast();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight"><Balancer>Settings</Balancer></h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        {user?.role === "managing_director" && (
          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
            <Link href="/settings/budget-thresholds">
              <Settings2 className="h-4 w-4" />
              Budget Approval Config
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-[720px]">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-6">
            <NotificationPreferencesForm />
            <MessageDigestPreferences />
            <GranularNotificationPreferences />
          </div>
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettingsForm />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarFeed />
        </TabsContent>

        <TabsContent value="api-keys">
          <div className="space-y-6">
            <APIKeysManager />
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plug className="h-5 w-5" />
                      Integrations
                    </CardTitle>
                    <CardDescription>
                      Connect AMG Portal with external services and automation platforms
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/settings/integrations">
                      Manage Integrations
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Set up webhooks, connect to Zapier, Make (Integromat), or build custom integrations
                  using our public API.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appearance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>
                  Select your preferred theme for the interface. Choose &quot;System&quot; to
                  automatically match your device&apos;s appearance settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {mounted ? (
                    <>
                      <Button
                        variant={theme === "light" && !highContrast ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setTheme("light");
                          setHighContrast(false);
                        }}
                        className="gap-2 min-w-[100px]"
                      >
                        <Sun className="h-4 w-4" />
                        Light
                      </Button>
                      <Button
                        variant={theme === "dark" && !highContrast ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setTheme("dark");
                          setHighContrast(false);
                        }}
                        className="gap-2 min-w-[100px]"
                      >
                        <Moon className="h-4 w-4" />
                        Dark
                      </Button>
                      <Button
                        variant={theme === "system" && !highContrast ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setTheme("system");
                          setHighContrast(false);
                        }}
                        className="gap-2 min-w-[100px]"
                      >
                        <Monitor className="h-4 w-4" />
                        System
                      </Button>
                    </>
                  ) : (
                    // Skeleton placeholders while mounting
                    <>
                      <Button variant="outline" size="sm" disabled className="gap-2 min-w-[100px]">
                        <Sun className="h-4 w-4" />
                        Light
                      </Button>
                      <Button variant="outline" size="sm" disabled className="gap-2 min-w-[100px]">
                        <Moon className="h-4 w-4" />
                        Dark
                      </Button>
                      <Button variant="outline" size="sm" disabled className="gap-2 min-w-[100px]">
                        <Monitor className="h-4 w-4" />
                        System
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Contrast className="h-5 w-5" />
                  High Contrast Mode
                </CardTitle>
                <CardDescription>
                  Enable high contrast mode for improved visual accessibility. This increases
                  contrast ratios, adds bold borders to interactive elements, and provides
                  clearer focus indicators.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mounted ? (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="high-contrast-toggle" className="text-base">
                        High Contrast
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Maximum contrast for text and UI elements (7:1+ ratio)
                      </p>
                    </div>
                    <Switch
                      id="high-contrast-toggle"
                      checked={highContrast}
                      onCheckedChange={setHighContrast}
                      aria-describedby="high-contrast-description"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">High Contrast</Label>
                      <p className="text-sm text-muted-foreground">
                        Maximum contrast for text and UI elements (7:1+ ratio)
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
