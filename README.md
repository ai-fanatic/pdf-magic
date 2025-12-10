# PDF Magic

Privacy-first, fully client-side PDF toolbox built with Next.js (App Router) and Tailwind. Convert images and Word files to PDF, merge, split, rotate, annotate, compress, and preview PDFs instantly—no uploads, no tracking.

## Features
- Images → PDF (multi-image, compressed)
- Word (.docx) → PDF (browser rendering)
- Merge, Split, Rotate PDFs
- Lightweight client-side compression
- Add text/watermark to every page
- Instant PDF viewer with download
- 100% in-browser: files never leave the device

## Quick start
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel
1) Push this repo to GitHub/GitLab/Bitbucket.  
2) In Vercel, import the project and keep defaults (`npm run build`).  
3) Deploy. Everything runs client-side, so no extra env vars or backend needed.

## Notes
- Word → PDF uses a client-side renderer; complex layouts may differ from Word.  
- Compression is lightweight; for heavy compression/ocr/redaction, plug in your own API while keeping the same UI.  
- Open source: fork and extend as you like.
