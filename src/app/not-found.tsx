import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <p className="font-display text-[15px] text-teal">404</p>
      <h1 className="mt-2 font-display text-[26px] font-medium tracking-tight text-ink">
        This page never got sent
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-ink-faint">
        The page you&apos;re looking for doesn&apos;t exist, or it moved.
      </p>
      <Button asChild className="mt-6" variant="teal">
        <Link href="/">Back to AI Mail Studio</Link>
      </Button>
    </div>
  );
}
