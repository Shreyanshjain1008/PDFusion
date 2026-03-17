import { FileBadge2, Lock, PenLine, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthCard from "../components/ui/AuthCard";
import { loginUser, registerUser } from "../services/api";
import { setAuthToken } from "../utils/auth";

const points = [
  { icon: Lock, title: "Secure Auth", text: "Supabase-backed authentication with token-based sessions." },
  { icon: PenLine, title: "Visual Signing", text: "Place signatures with precision across PDF pages." },
  { icon: FileBadge2, title: "Audit Ready", text: "Track every action in verifiable immutable logs." },
  { icon: ShieldCheck, title: "Tamper-Resistant", text: "Signed PDFs are generated and versioned safely." }
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const title = useMemo(() => (activeTab === "login" ? "Welcome back" : "Create your workspace"), [activeTab]);

  const submit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const payload = { email: formState.email.trim(), password: formState.password };
      const res = activeTab === "login" ? await loginUser(payload) : await registerUser(payload);
      setAuthToken(res.access_token);
      navigate("/dashboard");
    } catch (apiError) {
      const msg = apiError?.response?.data?.detail?.message || apiError?.response?.data?.detail || "Unable to authenticate right now";
      setError(typeof msg === "string" ? msg : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-soft">
      <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-red-200 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-slate-200 blur-3xl" />

      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-2">
        <section className="animate-fade">
          <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-red shadow-soft">PDFusion</p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-brand-dark md:text-5xl">Sign documents with speed, trust, and complete audit visibility.</h1>
          <p className="mt-4 max-w-xl text-base text-brand-gray">A production-oriented digital signature experience inspired by modern PDF tools, powered by FastAPI and Supabase.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {points.map((point, idx) => (
              <article key={point.title} className="animate-rise rounded-2xl border border-slate-200 bg-white p-4 shadow-soft" style={{ animationDelay: `${idx * 70}ms` }}>
                <point.icon className="mb-2 text-brand-red" size={18} />
                <p className="font-semibold text-brand-dark">{point.title}</p>
                <p className="mt-1 text-sm text-slate-500">{point.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-3 font-heading text-2xl font-semibold text-brand-dark">{title}</p>
          <AuthCard
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            formState={formState}
            setFormState={setFormState}
            onSubmit={submit}
            isLoading={isLoading}
            error={error}
          />
        </section>
      </div>
    </div>
  );
}