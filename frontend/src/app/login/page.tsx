import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            AMG Portal
          </h1>
          <p className="text-muted-foreground text-sm">
            Anchor Mill Group — Client & Partner Portal
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
