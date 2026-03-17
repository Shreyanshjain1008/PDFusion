import { FileCheck2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { clearAuthToken } from "../../utils/auth";

export default function AppShell({ children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuthToken();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-brand-soft pb-10">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-heading text-xl font-semibold text-brand-dark">
            <span className="rounded-xl bg-brand-red p-2 text-white">
              <FileCheck2 size={18} />
            </span>
            PDFusion
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-body text-sm font-bold text-brand-dark transition hover:border-brand-red hover:text-brand-red"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto mt-8 w-full max-w-6xl px-5">{children}</main>
    </div>
  );
}
