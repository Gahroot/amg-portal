import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MFASetup } from "@/components/auth/mfa-setup";

export const metadata = {
  title: "Set Up Two-Factor Authentication",
};

export default function MFASetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="font-serif text-2xl font-bold tracking-tight">
            Secure Your Account
          </CardTitle>
          <CardDescription>
            Two-factor authentication (2FA) is required for all AMG
            Portal accounts. Scan the QR code below with an
            authenticator app like Google Authenticator or Authy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MFASetup />
        </CardContent>
      </Card>
    </div>
  );
}
