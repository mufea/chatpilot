import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That URL is not part of ChatPilot yet. Check the docs or return to the homepage.
      </p>
      <Link href="/" className={cn(buttonVariants(), "mt-6 w-fit")}>
        Back home
      </Link>
    </div>
  );
}
