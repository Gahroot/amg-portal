import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-7xl font-bold tracking-tight text-foreground">
          404
        </h1>
        <h2 className="text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
