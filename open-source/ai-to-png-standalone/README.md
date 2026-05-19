# AI to PNG Standalone Demo

A minimal open-source extraction of ToolKnit's browser-based `AI to PNG` flow.

This package keeps the core client-side conversion path:

- load a supported `.ai` file in the browser
- parse it with `PDF.js`
- render each artboard/page to `Canvas`
- export PNG images
- optionally pack all PNGs into a ZIP with `JSZip`

It intentionally removes ToolKnit-specific pieces such as:

- usage limits
- analytics
- site navigation and SEO shell
- IndexedDB history storage
- account / auth integrations

## Live references

- ToolKnit main site: https://toolknit.com/
- ToolKnit AI to PNG tool: https://toolknit.com/tools/ai-to-png.html
- Release blog post: https://toolknit.com/blog/ai-to-png.html

## Files

- `index.html` — standalone UI shell
- `app.js` — browser conversion logic

## How it works

Modern Adobe Illustrator files can include a PDF-compatible layer. This demo uses that compatibility path:

1. read the uploaded `.ai` file as an `ArrayBuffer`
2. load it with `PDF.js`
3. render each page/artboard to a `canvas`
4. export each rendered result as `image/png`
5. bundle all outputs into a ZIP when needed

## Supported files

This works best with AI files saved from Illustrator CS and later **with PDF compatibility enabled**.

Very old Illustrator files that rely on legacy PostScript-only content are not supported.

## Running locally

You can open the files directly in a browser, but using a simple static server is recommended.

Examples:

### Python

```bash
python -m http.server 8080
```

### Node.js

```bash
npx serve .
```

Then open:

```text
http://localhost:8080
```

## CDN dependencies

This demo loads:

- `pdf.js` from cdnjs
- `JSZip` from cdnjs

If you want a fully offline version, replace those CDN scripts with local copies.

## Suggested next improvements

- drag sorting for multi-artboard output
- export naming presets
- JPEG / WebP output options
- thumbnail sidebar for large files
- worker-based progress reporting

## Notes

This is a standalone demo extracted for open-source sharing. The production ToolKnit version may continue to evolve independently.
