import { useEffect, useMemo, useState } from "react";

import DocumentList from "../components/ui/DocumentList";
import SigningWorkspace from "../components/ui/SigningWorkspace";
import UploadPanel from "../components/ui/UploadPanel";
import { createSignature, deleteDocument, finalizeDocument, getDocumentUrl, getDocuments, uploadDocument } from "../services/api";

export default function DashboardPage() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [signingBusy, setSigningBusy] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedPdfUrl, setSelectedPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [signMessage, setSignMessage] = useState("");

  const activeDocument = useMemo(() => documents.find((doc) => doc.id === selectedDocId) || null, [documents, selectedDocId]);

  const loadDocuments = async () => {
    setFetchLoading(true);
    try {
      const rows = await getDocuments();
      setDocuments(rows);
    } catch {
      setError("Could not fetch documents. Please login again.");
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    const loadPreview = async () => {
      if (!selectedDocId) {
        setSelectedPdfUrl("");
        return;
      }
      try {
        const res = await getDocumentUrl(selectedDocId, "original");
        setSelectedPdfUrl(res.url || "");
      } catch {
        setSignMessage("Could not load PDF preview.");
      }
    };
    loadPreview();
  }, [selectedDocId]);

  const handleUpload = async () => {
    if (!file) return;

    setUploadLoading(true);
    setError("");

    try {
      await uploadDocument(file);
      setFile(null);
      await loadDocuments();
    } catch (apiError) {
      const msg = apiError?.response?.data?.detail || "Upload failed";
      setError(typeof msg === "string" ? msg : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleOpenDocument = async (docId, version, download = false) => {
    try {
      const res = await getDocumentUrl(docId, version, download);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (apiError) {
      const msg = apiError?.response?.data?.detail || "Could not open document";
      setError(typeof msg === "string" ? msg : "Could not open document");
    }
  };

  const handleDeleteDocument = async (docId, filename) => {
    const confirmed = window.confirm(`Delete "${filename}" and all saved signatures? This cannot be undone.`);
    if (!confirmed) return;

    setError("");
    setSignMessage("");
    try {
      await deleteDocument(docId);
      if (selectedDocId === docId) {
        setSelectedDocId("");
        setSelectedPdfUrl("");
      }
      await loadDocuments();
    } catch (apiError) {
      const detail = apiError?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.message || JSON.stringify(detail || {}) || "Could not delete document";
      setError(msg);
    }
  };

  const handleSavePlacements = async (docId, placements) => {
    setSigningBusy(true);
    setSignMessage("");
    try {
      for (const item of placements) {
        await createSignature({
          doc_id: docId,
          page_number: item.pageNumber,
          x: item.pdfX,
          y: item.pdfY,
          width: item.width,
          height: item.height,
          image_base64: item.image
        });
      }
      setSignMessage(`${placements.length} placement(s) saved.`);
    } catch (apiError) {
      const detail = apiError?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.message || JSON.stringify(detail || {}) || "Could not save placements";
      setSignMessage(msg);
    } finally {
      setSigningBusy(false);
    }
  };

  const handleFinalize = async (docId) => {
    if (!docId) return;
    setSigningBusy(true);
    setSignMessage("");
    try {
      await finalizeDocument(docId);
      setSignMessage("Document finalized. You can now view or download signed PDF.");
      await loadDocuments();
    } catch (apiError) {
      const detail = apiError?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.message || JSON.stringify(detail || {}) || "Could not finalize document";
      setSignMessage(msg);
    } finally {
      setSigningBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <UploadPanel file={file} setFile={setFile} onUpload={handleUpload} isLoading={uploadLoading} error={error} />

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-brand-dark">Your documents</h2>
              <p className="text-sm text-slate-500">Select any document to launch split-screen signing workspace.</p>
            </div>
            <button
              type="button"
              onClick={loadDocuments}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand-red hover:text-brand-red"
            >
              Refresh
            </button>
          </div>

          {fetchLoading ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-soft">Loading documents...</div>
          ) : (
            <DocumentList
              documents={documents}
              onOpenOriginal={(docId) => handleOpenDocument(docId, "original")}
              onOpenSigned={(docId) => handleOpenDocument(docId, "signed")}
              onSelect={setSelectedDocId}
              onDelete={handleDeleteDocument}
            />
          )}
        </section>
      </div>

      <SigningWorkspace
        activeDocument={activeDocument}
        pdfUrl={selectedPdfUrl}
        setSelectedDocId={setSelectedDocId}
        onSavePlacements={handleSavePlacements}
        onFinalize={handleFinalize}
        onOpenSigned={(docId, download) => handleOpenDocument(docId, "signed", download)}
        busy={signingBusy}
        message={signMessage}
      />
    </div>
  );
}
