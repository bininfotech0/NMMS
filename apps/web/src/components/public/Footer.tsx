import { Logo } from "@/components/brand/Logo";
import { organization } from "@/lib/mock-data";

export function Footer() {
  return (
    <footer className="bg-brand-green-dark px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Logo variant="stacked" size={36} tone="light" className="items-start text-left" />
        <p className="mt-4 max-w-md text-sm text-white/70">{organization.tagline}</p>
        <p className="mt-3 max-w-md text-sm text-white/70">
          {organization.address}
          <br />
          {organization.phone} · {organization.email}
        </p>
        <p className="mt-6 text-xs text-white/50">
          © {new Date().getFullYear()} {organization.legalName}. All rights reserved.
          <br />
          CIN: {organization.cin} · {organization.roc}
        </p>
      </div>
    </footer>
  );
}
