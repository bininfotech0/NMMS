import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/">
          <Logo size={32} />
        </Link>
        <Button asChild className="ml-auto bg-brand-green hover:bg-brand-green/90">
          <Link to="/admin/login">Login</Link>
        </Button>
      </div>
    </header>
  );
}
