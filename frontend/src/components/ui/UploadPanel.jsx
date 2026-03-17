import { Upload } from "lucide-react";

export default function UploadPanel({ file, setFile, onUpload, isLoading, error }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
      <h2 className="font-heading text-xl font-semibold text-brand-dark">Upload PDF</h2>
      <p className="mt-1 text-sm text-slate-500">Only PDF files are accepted. We keep original and signed versions separately.</p>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 transition hover:border-brand-red hover:bg-red-50/30">
        <Upload className="mb-3 text-brand-red" size={26} />
        <span className="text-sm font-semibold text-slate-700">Choose PDF</span>
        <span className="mt-1 text-xs text-slate-500">Click to browse</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      {file ? <p className="mt-3 text-sm font-medium text-brand-dark">Selected: {file.name}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        disabled={!file || isLoading}
        onClick={onUpload}
        className="mt-4 rounded-2xl bg-brand-dark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Uploading..." : "Upload Document"}
      </button>
    </section>
  );
}