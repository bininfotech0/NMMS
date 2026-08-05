import { Outlet } from "react-router-dom";
import { PublicNav } from "@/components/public/PublicNav";
import { Footer } from "@/components/public/Footer";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
