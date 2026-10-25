import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_oklch(0.93_0.04_250),_transparent_45%)]">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-6">
        <Link href="/">
          <BrandMark />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 px-4 pb-16">{children}</main>
    </div>
  );
}
