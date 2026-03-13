"use client";

import { useParams, useRouter } from "next/navigation";

export default function ProgramBoardPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Program Board</h1>
        <button
          onClick={() => router.push(`/programs/${programId}`)}
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to Program
        </button>
      </div>
      <p className="text-muted-foreground">
        Kanban board view for program tasks and milestones.
      </p>
    </div>
  );
}
