import Link from "next/link";
import {
  ArrowRight,
  Reply,
  Sparkles,
  Gauge,
  Search,
  Star,
  SpellCheck2,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ComposePreview } from "@/components/shared/compose-preview";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: "Describe it, get a draft",
    body: "Say what the email needs to do in a sentence or two. AI Mail Studio writes the subject line and body in your voice.",
  },
  {
    icon: Gauge,
    title: "Tone and length, dialed in",
    body: "Pick a tone — direct, warm, formal — and a length. Every draft respects both instead of guessing.",
  },
  {
    icon: SpellCheck2,
    title: "Rewrite without starting over",
    body: "Make a draft more professional, friendlier, shorter, longer, clearer, or grammatically sound in one pass.",
  },
  {
    icon: Reply,
    title: "Replies that read the thread",
    body: "Paste an email you received and get a reply that actually responds to it, not a generic acknowledgment.",
  },
  {
    icon: Search,
    title: "Every email, searchable",
    body: "Saved drafts and sent copies live in one history you can search by subject, recipient, or content.",
  },
  {
    icon: Star,
    title: "Keep the ones that matter",
    body: "Favorite the emails you reuse as templates — a client update, an intro, a follow-up — and find them fast.",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Describe the email",
    body: "Tell it who you're writing to and what you need to say. A sentence is enough to start.",
  },
  {
    n: "2",
    title: "Tune tone and length",
    body: "Adjust until the draft sounds like something you'd actually send, not a template.",
  },
  {
    n: "3",
    title: "Edit and send",
    body: "Fine-tune the wording right in the editor, then copy it into your inbox and send.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
          <div className="grid items-center gap-14 md:grid-cols-2 md:gap-10">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
              <h1 className="font-display text-[42px] font-medium leading-[1.08] tracking-tight text-ink md:text-[54px]">
                Draft the email,
                <br />
                not the excuses.
              </h1>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-soft">
                Describe what you need to say and AI Mail Studio writes the
                subject line and body for you — so the follow-up you&apos;ve
                been avoiding takes ninety seconds, not a staring contest with
                a blank page.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" variant="teal">
                  <Link href="/compose">
                    Compose an email
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
              <p className="mt-5 text-[13px] text-ink-faint">
                Free to start — create an account to draft, save, and reply.
              </p>
            </div>

            <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-700 justify-center delay-100 md:justify-end">
              <ComposePreview />
            </div>
          </div>
        </section>

        {/* Product */}
        <section id="product" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8">
            <div className="max-w-lg">
              <h2 className="font-display text-[30px] font-medium tracking-tight text-ink">
                One editor, every email you write
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Cold outreach, client updates, apologies for the late reply —
                the same tools handle all of it.
              </p>
            </div>

            <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="border-t border-line pt-5">
                  <Icon className="h-[18px] w-[18px] text-teal" strokeWidth={1.75} />
                  <h3 className="mt-3 text-[15px] font-medium text-ink">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-faint">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-line bg-paper-raised">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8">
            <h2 className="font-display text-[30px] font-medium tracking-tight text-ink">
              From idea to inbox in three steps
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((step) => (
                <div key={step.n}>
                  <span className="font-display text-[15px] text-ink-faint">
                    {step.n}
                  </span>
                  <h3 className="mt-3 text-[16px] font-medium text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-faint">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-16 md:flex-row md:items-center md:px-8">
            <div>
              <h2 className="font-display text-[26px] font-medium tracking-tight text-ink">
                Your next email is one sentence away.
              </h2>
              <p className="mt-2 text-[14px] text-ink-soft">
                Free to start. No setup required.
              </p>
            </div>
            <Button asChild size="lg" variant="teal">
              <Link href="/signup">
                Create your account
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
