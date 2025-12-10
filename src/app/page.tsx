"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { Download, Loader2, ShieldCheck, Sparkles, UploadCloud, Wand2 } from "lucide-react";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import imageCompression from "browser-image-compression";
import mammoth from "mammoth";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type GeneratedFile = {
  url: string;
  name: string;
  sizeLabel: string;
  note?: string;
};

type ToolProps = {
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
};

const toPdfBlob = (bytes: Uint8Array) =>
  new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });

const DropZone = ({
  label,
  description,
  accept,
  multiple = false,
  onFiles,
}: {
  label: string;
  description: string;
  accept: Accept;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) => {
  const handleDrop = useCallback(
    (accepted: File[]) => {
      if (accepted?.length) {
        onFiles(accepted);
      }
    },
    [onFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    multiple,
  });

  return (
    <div
      {...getRootProps()}
      className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-5 transition hover:border-white/30 hover:bg-white/10 ${
        isDragActive ? "border-white/60 bg-white/15" : ""
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex items-center gap-3 text-sm font-medium text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-blue-200">
          <UploadCloud size={18} />
        </div>
        <div>
          <p className="text-white">{label}</p>
          <p className="text-xs text-white/70">{description}</p>
        </div>
      </div>
    </div>
  );
};

const ToolCard = ({ title, description, badge, children }: ToolProps) => (
  <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-blue-500/5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="text-sm text-white/70">{description}</p>
      </div>
      {badge ? (
        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100">
          {badge}
        </span>
      ) : null}
    </div>
    {children}
  </div>
);

export default function Home() {
  const [activeUrls, setActiveUrls] = useState<string[]>([]);
  const [singleResult, setSingleResult] = useState<GeneratedFile | null>(null);
  const [multiResult, setMultiResult] = useState<GeneratedFile[]>([]);
  const [annotationText, setAnnotationText] = useState("Approved via PDF Magic");
  const [rotation, setRotation] = useState(90);
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // jsPDF's html helper expects html2canvas on the window object.
    const w = window as typeof window & { html2canvas?: typeof html2canvas };
    w.html2canvas = html2canvas;
  }, []);

  const trackUrls = (urls: string[]) => {
    activeUrls.forEach((u) => URL.revokeObjectURL(u));
    setActiveUrls(urls);
  };

  useEffect(() => {
    return () => {
      activeUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [activeUrls]);

  const handleImagesToPdf = async (files: File[]) => {
    setLoadingTool("Images to PDF");
    setToast(null);
    setMultiResult([]);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 2400,
          maxSizeMB: 3,
          useWebWorker: true,
        });
        const compressedBytes = await compressed.arrayBuffer();
        const isPng = compressed.type.includes("png");
        const image = isPng ? await pdfDoc.embedPng(compressedBytes) : await pdfDoc.embedJpg(compressedBytes);
        const { width, height } = image.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
      const blob = toPdfBlob(pdfBytes);
      const url = URL.createObjectURL(blob);
      trackUrls([url]);
      setSingleResult({
        url,
        name: `images-${Date.now()}.pdf`,
        sizeLabel: formatBytes(blob.size),
        note: "Optimized for easy sharing",
      });
    } catch (error) {
      console.error(error);
      setToast("Could not convert images. Please try again.");
    } finally {
      setLoadingTool(null);
    }
  };

  const handleMerge = async (files: File[]) => {
    setLoadingTool("Merge");
    setToast(null);
    setMultiResult([]);
    try {
      const output = await PDFDocument.create();

      for (const file of files) {
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const copied = await output.copyPages(pdf, pdf.getPageIndices());
        copied.forEach((page) => output.addPage(page));
      }

      const pdfBytes = await output.save({ useObjectStreams: true });
      const blob = toPdfBlob(pdfBytes);
      const url = URL.createObjectURL(blob);
      trackUrls([url]);
      setSingleResult({
        url,
        name: `merged-${Date.now()}.pdf`,
        sizeLabel: formatBytes(blob.size),
        note: `Combined ${files.length} PDF${files.length > 1 ? "s" : ""}`,
      });
    } catch (error) {
      console.error(error);
      setToast("Merge failed. Double-check your files and retry.");
    } finally {
      setLoadingTool(null);
    }
  };

  const handleSplit = async (file: File) => {
    setLoadingTool("Split");
    setToast(null);
    setSingleResult(null);

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const outputs: GeneratedFile[] = [];

      for (let i = 0; i < pdf.getPageCount(); i++) {
        const doc = await PDFDocument.create();
        const [page] = await doc.copyPages(pdf, [i]);
        doc.addPage(page);
        const bytes = await doc.save({ useObjectStreams: true });
        const blob = toPdfBlob(bytes);
        const url = URL.createObjectURL(blob);
        outputs.push({
          url,
          name: `${file.name.replace(/\.pdf$/i, "")}-page-${i + 1}.pdf`,
          sizeLabel: formatBytes(blob.size),
        });
      }

      trackUrls(outputs.map((o) => o.url));
      setMultiResult(outputs);
      setToast(`Created ${outputs.length} single-page PDF${outputs.length > 1 ? "s" : ""}.`);
    } catch (error) {
      console.error(error);
      setToast("Split failed. Ensure the PDF is not encrypted.");
    } finally {
      setLoadingTool(null);
    }
  };

  const handleRotate = async (file: File) => {
    setLoadingTool("Rotate");
    setToast(null);
    setMultiResult([]);

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      pdf.getPages().forEach((page) => page.setRotation(degrees(rotation)));
      const bytes = await pdf.save({ useObjectStreams: true });
      const blob = toPdfBlob(bytes);
      const url = URL.createObjectURL(blob);
      trackUrls([url]);
      setSingleResult({
        url,
        name: `${file.name.replace(/\.pdf$/i, "")}-rotated.pdf`,
        sizeLabel: formatBytes(blob.size),
        note: `Rotated all pages by ${rotation}°`,
      });
    } catch (error) {
      console.error(error);
      setToast("Rotate failed. Try another PDF.");
    } finally {
      setLoadingTool(null);
    }
  };

  const handleCompress = async (file: File) => {
    setLoadingTool("Compress");
    setToast("Applying a lightweight compression pass…");
    setMultiResult([]);

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const bytes = await pdf.save({ useObjectStreams: true });
      const blob = toPdfBlob(bytes);
      const url = URL.createObjectURL(blob);
      trackUrls([url]);
      setSingleResult({
        url,
        name: `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`,
        sizeLabel: formatBytes(blob.size),
        note: "Client-side save optimized object streams",
      });
      setToast("Done. Heavier compression needs server-side tools.");
    } catch (error) {
      console.error(error);
      setToast("Compression failed. Try a different file.");
    } finally {
      setLoadingTool(null);
    }
  };

  const handleAnnotate = async (file: File) => {
    if (!annotationText.trim()) {
      setToast("Add some annotation text first.");
      return;
    }
    setLoadingTool("Annotate");
    setToast(null);
    setMultiResult([]);

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pages = pdf.getPages();
      const margin = 24;
      pages.forEach((page) => {
        const { height } = page.getSize();
        page.drawText(annotationText, {
          x: margin,
          y: height - margin - 16,
          size: 14,
          font,
          color: rgb(0, 0, 0),
          opacity: 0.85,
        });
      });

      const bytes = await pdf.save({ useObjectStreams: true });
      const blob = toPdfBlob(bytes);
      const url = URL.createObjectURL(blob);
      trackUrls([url]);
      setSingleResult({
        url,
        name: `${file.name.replace(/\.pdf$/i, "")}-annotated.pdf`,
        sizeLabel: formatBytes(blob.size),
        note: "Added on-page text. Great for approvals or stamps.",
      });
    } catch (error) {
      console.error(error);
      setToast("Annotation failed. Try again.");
    } finally {
      setLoadingTool(null);
    }
  };

  const handleWordToPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setToast("Only .docx files are supported for Word to PDF.");
      return;
    }
    setLoadingTool("Word");
    setToast("Rendering your document in the browser…");
    setMultiResult([]);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
      const pdf = new jsPDF({ unit: "pt", format: "a4" });

      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.width = "800px";
      container.style.padding = "24px";
      container.style.color = "#0f1117";
      container.style.background = "#fff";
      container.style.fontFamily = "Inter, system-ui, sans-serif";
      container.style.fontSize = "12pt";
      container.style.lineHeight = "1.5";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      await pdf.html(container, {
        html2canvas: { scale: 2 },
        autoPaging: "text",
        margin: [20, 20, 20, 20],
        callback: () => {
          document.body.removeChild(container);
        },
      });

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      trackUrls([url]);
      setSingleResult({
        url,
        name: `${file.name.replace(/\.docx$/i, "")}.pdf`,
        sizeLabel: formatBytes(blob.size ?? 0),
        note: "Client-side .docx to PDF preview",
      });
      setToast("Converted locally. Layout may differ from Word.");
    } catch (error) {
      console.error(error);
      setToast("Word to PDF failed. Try a simpler document.");
    } finally {
      setLoadingTool(null);
    }
  };

  const isBusy = (tool: string) => loadingTool === tool;

  const actionButton = (label: string) => (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
      {isBusy(label) ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
      {isBusy(label) ? "Working…" : "Instant preview & download"}
    </div>
  );

  const privacyPoints = useMemo(
    () => [
      "Runs 100% in your browser — files never leave your device.",
      "Open source. Fork it, self-host it, or deploy to Vercel in minutes.",
      "Clean UI with drag & drop, no ads, no accounts, no tracking.",
      "Built for solo builders and teams who need quick PDF workflows.",
    ],
    [],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-blue-500/10 sm:p-10">
        <div className="absolute right-8 top-8 hidden rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 md:block">
          Open Source · Vercel Ready
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-100">
              <ShieldCheck size={16} />
              Privacy-first PDF studio
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              PDF Magic — convert, edit, merge, split, rotate, compress, and view instantly.
            </h1>
            <p className="text-lg text-white/80">
              Drop anything. We transform it entirely in your browser, then show a ready-to-download PDF preview. Zero
              uploads, zero storage, zero hassle.
            </p>
            <div className="flex flex-wrap gap-2 text-sm text-white/70">
              {["Image → PDF", "Merge", "Split", "Rotate", "Compress", "Annotate", "Word → PDF"].map((item) => (
                <span key={item} className="rounded-full border border-white/15 px-3 py-1">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80 lg:mt-0 lg:w-72">
            {privacyPoints.map((point) => (
              <div key={point} className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 text-emerald-200" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ToolCard title="Images to PDF" description="Drag in one or many images. We compress and assemble a PDF page per image." badge="Fast">
          <DropZone
            label="Drop images or click to pick"
            description="JPG, PNG, HEIC · multiple files supported"
            accept={{ "image/*": [".png", ".jpg", ".jpeg", ".heic", ".webp"] }}
            multiple
            onFiles={handleImagesToPdf}
          />
          {actionButton("Images to PDF")}
        </ToolCard>

        <ToolCard title="Word to PDF" description="Convert .docx files to PDF right in the browser." badge="Beta">
          <DropZone
            label="Drop a .docx file"
            description="We render to PDF without uploading"
            accept={{ "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }}
            onFiles={(files) => handleWordToPdf(files[0])}
          />
          {actionButton("Word")}
        </ToolCard>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ToolCard title="Merge PDF" description="Combine multiple PDFs into one. Drag in the order you want.">
          <DropZone
            label="Drop PDFs to merge"
            description="We keep your order"
            accept={{ "application/pdf": [".pdf"] }}
            multiple
            onFiles={handleMerge}
          />
          {actionButton("Merge")}
        </ToolCard>

        <ToolCard title="Split PDF" description="Instantly split into single-page PDFs for download.">
          <DropZone
            label="Drop a PDF to split"
            description="We return one PDF per page"
            accept={{ "application/pdf": [".pdf"] }}
            onFiles={(files) => handleSplit(files[0])}
          />
          {actionButton("Split")}
        </ToolCard>

        <ToolCard title="Rotate PDF" description="Rotate every page 90° / 180° / 270° and download.">
          <div className="flex items-center gap-3">
            <label className="text-sm text-white/80">Rotation</label>
            <select
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none"
            >
              {[90, 180, 270].map((angle) => (
                <option key={angle} value={angle}>
                  {angle}°
                </option>
              ))}
            </select>
          </div>
          <DropZone
            label="Drop a PDF to rotate"
            description="Applies to all pages"
            accept={{ "application/pdf": [".pdf"] }}
            onFiles={(files) => handleRotate(files[0])}
          />
          {actionButton("Rotate")}
        </ToolCard>

        <ToolCard title="Compress PDF" description="Quick client-side save to trim metadata and streams.">
          <DropZone
            label="Drop a PDF to compress"
            description="Lightweight compression (best for text PDFs)"
            accept={{ "application/pdf": [".pdf"] }}
            onFiles={(files) => handleCompress(files[0])}
          />
          {actionButton("Compress")}
        </ToolCard>

        <ToolCard title="Edit PDF (add text)" description="Stamp every page with a note, approval, or watermark.">
          <label className="text-sm text-white/80">
            Annotation text
            <input
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none"
              placeholder="Approved via PDF Magic"
            />
          </label>
          <DropZone
            label="Drop a PDF to annotate"
            description="Adds text to every page"
            accept={{ "application/pdf": [".pdf"] }}
            onFiles={(files) => handleAnnotate(files[0])}
          />
          {actionButton("Annotate")}
        </ToolCard>

        <ToolCard title="View PDF instantly" description="Just drop to preview. Great for quick checks." badge="Viewer">
          <DropZone
            label="Drop to preview"
            description="We render in-browser for instant view"
            accept={{ "application/pdf": [".pdf"] }}
            onFiles={(files) => {
              const file = files[0];
              const url = URL.createObjectURL(file);
              trackUrls([url]);
              setSingleResult({
                url,
                name: file.name,
                sizeLabel: formatBytes(file.size),
                note: "Original file — instant viewer",
              });
              setMultiResult([]);
              setToast("Preview only — no changes made.");
            }}
          />
          {actionButton("Viewer")}
        </ToolCard>
      </section>

      {toast ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          <Wand2 size={16} className="text-amber-200" />
          {toast}
        </div>
      ) : null}

      {(singleResult || multiResult.length) && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white">Your output</p>
              <p className="text-sm text-white/70">
                Preview and download immediately. Links are generated locally and safe to share.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
              <ShieldCheck size={16} /> No uploads. Ever.
            </div>
          </div>

          {singleResult ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-white">
                  <Download size={16} />
                  {singleResult.name}
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/80">
                  {singleResult.sizeLabel}
                </span>
                {singleResult.note ? (
                  <span className="rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-100">{singleResult.note}</span>
                ) : null}
                <a
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600"
                  href={singleResult.url}
                  download={singleResult.name}
                >
                  <Download size={16} />
                  Download
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <iframe title="PDF preview" src={singleResult.url} className="h-[520px] w-full bg-white" />
              </div>
            </div>
          ) : null}

          {multiResult.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {multiResult.map((file) => (
                <div key={file.url} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="text-sm font-semibold text-white">{file.name}</div>
                  <div className="text-xs text-white/60">{file.sizeLabel}</div>
                  <a
                    href={file.url}
                    download={file.name}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    <Download size={16} /> Download
                  </a>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <section className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="text-base font-semibold text-white">Built for peace of mind</p>
          <p>Everything runs locally. Close the tab, and your files vanish. We keep zero logs.</p>
        </div>
        <div className="space-y-2">
          <p className="text-base font-semibold text-white">Deploy it yourself</p>
          <p>One-click deploy to Vercel. Or fork it, tweak the UI, and self-host wherever you like.</p>
        </div>
        <div className="space-y-2">
          <p className="text-base font-semibold text-white">Need more tools?</p>
          <p>Add OCR, redaction, or stronger compression by plugging in your own API while keeping the open UI.</p>
        </div>
      </section>
    </main>
  );
}
