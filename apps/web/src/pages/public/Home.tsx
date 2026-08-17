import { GraduationCap, Leaf, HeartPulse, Users, Sprout, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HeroIllustration } from "@/components/brand/HeroIllustration";
import { organization } from "@/lib/mock-data";

const PROGRAMS = [
  {
    icon: GraduationCap,
    title: "Education",
    description: "Promoting quality education for all, from foundational literacy to skill-building.",
  },
  {
    icon: Leaf,
    title: "Environment",
    description: "Planting trees and building sustainable habits for a greener tomorrow.",
  },
  {
    icon: HeartPulse,
    title: "Health",
    description: "Running awareness camps and support programs for healthier communities.",
  },
  {
    icon: Users,
    title: "Empowerment",
    description: "Equipping youth and women with the skills and confidence to lead.",
  },
];

export function Home() {
  return (
    <div>
      <section className="relative overflow-hidden bg-brand-bg-soft">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-green shadow-sm ring-1 ring-brand-green/15">
              <Sprout className="size-3.5" />
              {organization.legalName}
            </span>

            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-brand-green-dark sm:text-5xl">
              {organization.tagline}
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
              {organization.name} is committed to empowering communities through education, health,
              environment and sustainable development initiatives across Jharkhand.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="bg-brand-green hover:bg-brand-green/90">
                <Link to="/admin/login">
                  Staff Login
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <a
                href="#programs"
                className="text-sm font-semibold text-brand-green-dark underline-offset-4 hover:underline"
              >
                See our focus areas
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-lg ring-1 ring-brand-green/10">
              <HeroIllustration />
            </div>

            <div className="absolute -left-4 top-6 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-md ring-1 ring-border sm:flex">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
                <GraduationCap className="size-4" />
              </span>
              <span className="text-sm font-semibold text-brand-green-dark">Education first</span>
            </div>

            <div className="absolute -bottom-4 right-4 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-md ring-1 ring-border sm:flex">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
                <HeartPulse className="size-4" />
              </span>
              <span className="text-sm font-semibold text-brand-green-dark">Healthier communities</span>
            </div>
          </div>
        </div>
      </section>

      <section id="programs" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl font-bold text-brand-green-dark sm:text-3xl">Our Focus Areas</h2>
          <p className="mt-3 text-muted-foreground">
            Four pillars guide every program we run — each one rooted in the same goal: helping
            communities grow.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green transition-colors group-hover:bg-brand-green group-hover:text-white">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-heading font-semibold text-brand-green-dark">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-brand-green-dark">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-12 text-center sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
            Part of our team? Sign in to manage members and programs.
          </h2>
          <Button asChild size="lg" className="bg-brand-gold text-brand-green-dark hover:bg-brand-gold/90">
            <Link to="/admin/login">
              Staff Login
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
