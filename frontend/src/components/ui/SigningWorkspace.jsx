import { Download, Eye, PenSquare, Type } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function makeTextImage(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "700 42px Manrope";
  ctx.fillText(text || "Signed", 24, 88);
  return canvas.toDataURL("image/png");
}

function hasCanvasDrawing(canvas) {
  if (!canvas) return false;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let idx = 3; idx < pixels.length; idx += 4) {
    if (pixels[idx] !== 0) {
      return true;
    }
  }
  return false;
}

export default function SigningWorkspace({
  activeDocument,
  pdfUrl,
  setSelectedDocId,
  onSavePlacements,
  onFinalize,
  onOpenSigned,
  busy,
  message
}) {
  const [tool, setTool] = useState("signature");
  const [textValue, setTextValue] = useState("Approved");
  const [stampWidth, setStampWidth] = useState(170);
  const [stampHeight, setStampHeight] = useState(70);
  const [numPages, setNumPages] = useState(0);
  const [queued, setQueued] = useState([]);
  const [pageDims, setPageDims] = useState({});
  const [drawMode, setDrawMode] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [dragState, setDragState] = useState(null);
  const signatureCanvasRef = useRef(null);

  const title = useMemo(() => activeDocument?.filename || "Select document", [activeDocument]);

  const startDraw = (event) => {
    const rect = signatureCanvasRef.current.getBoundingClientRect();
    setDrawMode(true);
    setLastPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const moveDraw = (event) => {
    if (!drawMode || !lastPoint) return;
    const rect = signatureCanvasRef.current.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const ctx = signatureCanvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setLastPoint(point);
  };

  const stopDraw = () => {
    setDrawMode(false);
    setLastPoint(null);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const onPageLoaded = (page) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageDims((prev) => ({ ...prev, [page.pageNumber]: { pdfWidth: viewport.width, pdfHeight: viewport.height } }));
  };

  const enqueuePlacement = (event, pageNumber) => {
    if (event.target.closest("[data-placement='true']")) return;
    if (dragState) return;
    if (!activeDocument) return;
    const wrapper = event.currentTarget;
    const rect = wrapper.getBoundingClientRect();
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;
    const dim = pageDims[pageNumber];
    if (!dim) return;
    if (tool === "signature" && !hasCanvasDrawing(signatureCanvasRef.current)) return;

    const pdfX = (displayX / rect.width) * dim.pdfWidth;
    const pdfY = (displayY / rect.height) * dim.pdfHeight;
    const image = tool === "text" ? makeTextImage(textValue) : signatureCanvasRef.current.toDataURL("image/png");

    setQueued((prev) => [
      ...prev,
      {
        tempId: `${pageNumber}-${Date.now()}-${Math.random()}`,
        pageNumber,
        pdfX,
        pdfY,
        width: Number(stampWidth),
        height: Number(stampHeight),
        image,
        displayX,
        displayY
      }
    ]);
  };

  const startPlacementDrag = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = event.currentTarget.closest("[data-page-wrapper='true']");
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    wrapper.setPointerCapture(event.pointerId);
    setDragState({
      tempId: item.tempId,
      pageNumber: item.pageNumber,
      pointerId: event.pointerId,
      offsetX: pointerX - item.displayX,
      offsetY: pointerY - item.displayY
    });
  };

  const movePlacementDrag = (event, pageNumber) => {
    if (!dragState || dragState.pageNumber !== pageNumber || dragState.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dim = pageDims[pageNumber];
    if (!dim) return;

    const nextDisplayX = event.clientX - rect.left - dragState.offsetX;
    const nextDisplayY = event.clientY - rect.top - dragState.offsetY;
    const item = queued.find((queuedItem) => queuedItem.tempId === dragState.tempId);
    if (!item) return;
    const maxX = rect.width - item.width;
    const maxY = rect.height - item.height;
    const clampedX = Math.max(0, Math.min(nextDisplayX, maxX));
    const clampedY = Math.max(0, Math.min(nextDisplayY, maxY));
    const nextPdfX = (clampedX / rect.width) * dim.pdfWidth;
    const nextPdfY = (clampedY / rect.height) * dim.pdfHeight;

    setQueued((prev) =>
      prev.map((item) =>
        item.tempId === dragState.tempId
          ? { ...item, displayX: clampedX, displayY: clampedY, pdfX: nextPdfX, pdfY: nextPdfY }
          : item
      )
    );
  };

  const endPlacementDrag = (event) => {
    if (dragState && event?.currentTarget?.hasPointerCapture?.(dragState.pointerId)) {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    }
    setDragState(null);
  };

  const removePlacement = (event, tempId) => {
    event.preventDefault();
    event.stopPropagation();
    setQueued((prev) => prev.filter((item) => item.tempId !== tempId));
    if (dragState?.tempId === tempId) {
      setDragState(null);
    }
  };

  const saveQueued = async () => {
    if (!queued.length || !activeDocument) return;
    await onSavePlacements(activeDocument.id, queued);
    setQueued([]);
  };

  if (!activeDocument) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="font-heading text-xl font-semibold text-brand-dark">Select a document to start signing</p>
        <p className="mt-2 text-sm text-slate-500">Click `Select for Signing` from any uploaded document.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft md:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="font-heading text-xl font-semibold text-brand-dark">Signing Workspace</p>
          <p className="text-xs text-slate-500">{title}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDocId("")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {!pdfUrl ? (
            <p className="text-sm text-slate-500">Loading preview...</p>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: pages }) => {
                setPdfError("");
                setNumPages(pages);
              }}
              onLoadError={(err) => setPdfError(`PDF load failed: ${err?.message || "unknown error"}`)}
            >
              {Array.from({ length: numPages }, (_, idx) => {
                const pageNumber = idx + 1;
                const pageQueued = queued.filter((item) => item.pageNumber === pageNumber);
                return (
                  <div
                    key={pageNumber}
                    className="relative mb-4 cursor-crosshair rounded-xl border border-slate-300 bg-white"
                    onClickCapture={(event) => enqueuePlacement(event, pageNumber)}
                    onPointerMove={(event) => movePlacementDrag(event, pageNumber)}
                    onPointerUp={endPlacementDrag}
                    onPointerCancel={endPlacementDrag}
                    data-page-wrapper="true"
                  >
                    <Page pageNumber={pageNumber} width={560} onLoadSuccess={onPageLoaded} />
                    {pageQueued.map((item) => (
                      <button
                        key={item.tempId}
                        type="button"
                        onPointerDown={(event) => startPlacementDrag(event, item)}
                        className={`absolute overflow-hidden rounded border-2 bg-white/80 shadow-md ${dragState?.tempId === item.tempId ? "cursor-grabbing border-brand-dark" : "cursor-grab border-brand-red"}`}
                        style={{
                          left: item.displayX,
                          top: item.displayY,
                          width: item.width,
                          height: item.height,
                          zIndex: 20
                        }}
                        data-placement="true"
                        title="Drag to reposition"
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          onPointerDown={(event) => removePlacement(event, item.tempId)}
                          onClick={(event) => removePlacement(event, item.tempId)}
                          className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-brand-dark text-[11px] font-bold text-white"
                          title="Delete placement"
                        >
                          x
                        </span>
                        <img src={item.image} alt="signature placement" className="h-full w-full object-contain pointer-events-none" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </Document>
          )}
          {pdfError ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{pdfError}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setTool("signature")}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold ${tool === "signature" ? "bg-brand-red text-white" : "bg-slate-100 text-slate-700"}`}
            >
              <PenSquare size={14} />
              Draw Signature
            </button>
            <button
              type="button"
              onClick={() => setTool("text")}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold ${tool === "text" ? "bg-brand-red text-white" : "bg-slate-100 text-slate-700"}`}
            >
              <Type size={14} />
              Write Text
            </button>
          </div>

          {tool === "signature" ? (
            <div>
              <canvas
                ref={signatureCanvasRef}
                width={360}
                height={120}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={stopDraw}
                onPointerLeave={stopDraw}
                className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50"
              />
              <button type="button" onClick={clearSignature} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                Clear
              </button>
            </div>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Text</span>
              <input
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-red"
              />
            </label>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Width</span>
              <input type="number" value={stampWidth} onChange={(e) => setStampWidth(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Height</span>
              <input type="number" value={stampHeight} onChange={(e) => setStampHeight(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>

          <p className="mt-3 text-xs text-slate-500">Click a PDF page to create a stamp, drag it where needed, or use the small `x` on the stamp to delete it before saving. Queued items: {queued.length}</p>
          {message ? <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={saveQueued}
              disabled={!queued.length || busy}
              className="rounded-xl bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save Placements"}
            </button>
            <button
              type="button"
              onClick={() => onFinalize(activeDocument.id)}
              disabled={busy}
              className="rounded-xl bg-brand-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Finalizing..." : "Finalize PDF"}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => onOpenSigned(activeDocument.id, false)} className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                <Eye size={14} />
                View Signed
              </button>
              <button type="button" onClick={() => onOpenSigned(activeDocument.id, true)} className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
