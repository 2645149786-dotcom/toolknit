# Background Remover Standalone Demo

A minimal open-source extraction of ToolKnit's browser-based AI background remover.

This package demonstrates the full client-side background removal pipeline:

- upload an image (JPG, PNG, WebP)
- run AI-powered background removal using `@imgly/background-removal` (ONNX model via WebAssembly)
- preview the transparent result
- manually refine the mask with brush/eraser tools
- download the final PNG with transparent background

No server uploads, no signup, no analytics — everything runs in your browser.

## Live references

- ToolKnit main site: https://toolknit.com/
- ToolKnit Background Remover: https://toolknit.com/tools/background-remover.html
- GitHub: https://github.com/2645149786-dotcom/toolknit

## Files

- `index.html` — standalone UI shell with all styles
- `app.js` — complete removal + refinement logic (ES module)

## How it works

1. User uploads an image
2. The `@imgly/background-removal` library is loaded from jsDelivr CDN
3. The ONNX model (~40 MB) downloads on first use and is cached by the browser
4. AI inference runs locally via WebAssembly to produce a foreground mask
5. The mask is rendered on a Canvas for preview
6. User can manually refine the mask using brush (restore) or eraser (remove) tools
7. Final result is exported as a full-resolution transparent PNG

## Key features

- **AI-powered**: Uses a neural network (ONNX) to detect subjects with fine edge detail
- **100% private**: No image data leaves the device
- **Manual refinement**: Brush/eraser with adjustable size and softness
- **Undo support**: Up to 20 undo steps
- **Keyboard shortcuts**: `B` brush, `E` eraser, `[`/`]` resize, `Ctrl+Z` undo
- **Touch support**: Works on mobile/tablet
- **Responsive**: Adapts to any screen size

## Running locally

This demo uses ES modules, so you need a local server (not `file://`).

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

## CDN dependency

This demo loads `@imgly/background-removal@1.5.5` from jsDelivr at runtime.

The library handles:
- ONNX Runtime Web (WebAssembly)
- Model weight downloading and caching
- Image segmentation inference

If you want a fully offline version, you would need to:
1. Install the package locally: `npm install @imgly/background-removal`
2. Host the model weights yourself
3. Update the import path in `app.js`

## Removed from production version

This open-source demo intentionally strips:

- Usage limits and auth
- Analytics and tracking
- Site navigation and SEO shell
- Sound effects
- Custom model hosting path (uses library defaults)

## Supported images

- **Formats**: JPG, PNG, WebP
- **Max size**: 20 MB
- **Best results**: Images with clear contrast between subject and background

## Suggested improvements

- Add background replacement (solid color, custom image)
- Batch processing for multiple images
- Edge feathering controls
- Before/after comparison slider
- WebGPU acceleration when available

## License

MIT

## Notes

This is a standalone demo extracted for open-source sharing. The production ToolKnit version may continue to evolve independently.
