import { AlertCircle, CheckCircle2, FileText, Trash2, UploadCloud } from "lucide-react";

export default function DocumentList({ documents, onOpenOriginal, onOpenSigned, onSelect, onDelete }) {
  if (!documents.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft">
        <UploadCloud className="mx-auto mb-3 text-slate-400" size={28} />
        <p className="font-heading text-xl font-semibold text-brand-dark">No documents yet</p>
        <p className="mt-2 text-sm text-slate-500">Upload your first PDF to start your signing workflow.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {documents.map((doc, idx) => (
        <article
          key={doc.id}
          className="animate-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-soft"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-slate-100 p-2 text-brand-dark">
                <FileText size={18} />
              </span>
              <div>
                <p className="font-semibold text-brand-dark">{doc.filename}</p>
                <p className="text-xs text-slate-500">Created: {new Date(doc.created_at).toLocaleString()}</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${doc.status === "signed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {doc.status === "signed" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {doc.status}
            </span>
          </div>
          <p className="mt-3 break-all text-xs text-slate-500">ID: {doc.id}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenOriginal(doc.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-red hover:text-brand-red"
            >
              Open Original
            </button>
            <button
              type="button"
              onClick={() => onSelect(doc.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-red hover:text-brand-red"
            >
              Select for Signing
            </button>
            <button
              type="button"
              onClick={() => onDelete(doc.id, doc.filename)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 hover:text-red-700"
            >
              <Trash2 size={14} />
              Delete
            </button>
            {doc.status === "signed" ? (
              <button
                type="button"
                onClick={() => onOpenSigned(doc.id)}
                className="rounded-lg bg-brand-dark px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
              >
                Open Signed
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
