import clsx from "clsx";

export default function AuthCard({ activeTab, setActiveTab, formState, setFormState, onSubmit, isLoading, error }) {
  return (
    <div className="animate-rise rounded-3xl border border-slate-200 bg-white p-6 shadow-soft md:p-8">
      <div className="mb-5 inline-flex rounded-full bg-slate-100 p-1">
        {[
          { id: "login", label: "Login" },
          { id: "register", label: "Register" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === tab.id ? "bg-brand-red text-white" : "text-slate-600 hover:text-brand-dark"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Email</span>
          <input
            type="email"
            value={formState.email}
            onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
            required
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-brand-red focus:shadow-glow"
            placeholder="you@company.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Password</span>
          <input
            type="password"
            value={formState.password}
            onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
            required
            minLength={8}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-brand-red focus:shadow-glow"
            placeholder="At least 8 characters"
          />
        </label>

        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-brand-red px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Processing..." : activeTab === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  );
}