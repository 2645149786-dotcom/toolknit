# ToolKnit

ToolKnit is a collection of browser-based tools for PDF, image, video, audio, text, and everyday utility workflows.

The goal is to make common tasks faster and simpler with privacy-friendly web tools that work directly in the browser whenever possible.

## Website

- Main site: https://toolknit.com/
- AI to PNG: https://toolknit.com/tools/ai-to-png.html
- Background Remover: https://toolknit.com/tools/background-remover.html
- Latest blog post: https://toolknit.com/blog/ai-to-png.html

## What ToolKnit focuses on

- Browser-based workflows
- Privacy-friendly processing
- No signup required
- Simple tools for everyday use
- PDF, image, video, audio, text, and productivity utilities

## Featured areas

### PDF tools
Compress, merge, convert, and handle common document workflows directly on the web.

### Image tools
Convert formats, crop, resize, remove backgrounds, and handle lightweight image editing tasks.

### Video and audio tools
Use quick browser-based media tools for simple conversion and utility workflows.

### Text and utility tools
Access practical tools for writing, calculation, timing, and other everyday tasks.

## Recent update

ToolKnit recently added a new AI to PNG tool for quick browser-based export workflows:

https://toolknit.com/tools/ai-to-png.html

This release also expands the image workflow by pairing well with background removal and other lightweight image utilities.

## Open source

### AI to PNG Standalone Demo

A minimal extraction of the browser-based AI to PNG conversion flow, ready to run independently.

- Path: [`open-source/ai-to-png-standalone/`](./open-source/ai-to-png-standalone/)
- Stack: PDF.js + Canvas API + JSZip
- No server, no signup, no analytics — just the core conversion logic

### Background Remover Standalone Demo

AI-powered background removal running entirely in the browser with manual brush/eraser refinement.

- Path: [`open-source/background-remover-standalone/`](./open-source/background-remover-standalone/)
- Stack: @imgly/background-removal (ONNX via WebAssembly) + Canvas mask editing
- Features: auto AI removal, manual brush/eraser, undo, keyboard shortcuts, touch support

## Notes

This repository is mainly used for product documentation, release notes, open-source demos, and general project presence for ToolKnit.
