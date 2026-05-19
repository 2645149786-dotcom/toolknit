// ============================================================
//  Background Remover — Standalone Open Source Demo
//  AI auto-removal + Manual brush/eraser refinement
//  Uses @imgly/background-removal (ONNX model via WebAssembly)
// ============================================================

const LIB_CDN = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5';

// ── State ──────────────────────────────────────────────
let originalImage = null;
let resultBlob = null;
let maskCanvas = null;
let maskCtx = null;
let origCanvas = null;
let origCtx = null;
let undoStack = [];
const MAX_UNDO = 20;

let currentMode = 'preview';
let currentTool = 'brush';
let isDrawing = false;
let lastX = 0, lastY = 0;
let removeBackgroundFn = null;

// ── DOM refs ───────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlayDesc = $('overlay-desc');
const overlayProg = $('overlay-progress');
const overlayStatus = $('overlay-status');

const dropzone = $('dropzone');
const fileInput = $('file-input');
const browseBtn = $('browse-btn');
const uploadZone = $('upload-zone');
const fileInfo = $('file-info');
const fileNameEl = $('file-name');
const fileSizeEl = $('file-size');
const fileDimsEl = $('file-dims');
const fileThumbImg = $('file-thumb-img');
const removeFileBtn = $('remove-file-btn');
const actionBar = $('action-bar');
const autoRemoveBtn = $('auto-remove-btn');

const resultArea = $('result-area');
const canvasWrapper = $('canvas-wrapper');
const previewCanvas = $('preview-canvas');
const editCanvas = $('edit-canvas');
const previewCtx = previewCanvas.getContext('2d');
const editCtx = editCanvas.getContext('2d');

const btnPreview = $('btn-preview');
const btnRefine = $('btn-refine');
const btnReprocess = $('btn-reprocess');
const refineToolbar = $('refine-toolbar');
const refineHint = $('refine-hint');

const toolBrush = $('tool-brush');
const toolEraser = $('tool-eraser');
const brushSizeEl = $('brush-size');
const brushSizeVal = $('brush-size-val');
const brushSoftEl = $('brush-softness');
const brushSoftVal = $('brush-softness-val');
const toolUndo = $('tool-undo');

const brushCursor = $('brush-cursor');
const downloadBtn = $('download-btn');
const newBtn = $('new-btn');

// ── Helpers ────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function showOverlay(title, desc) {
  overlayTitle.textContent = title || 'Loading AI Model...';
  overlayDesc.innerHTML = desc || 'First time takes ~30 seconds.<br>The model is cached for future use.';
  overlayProg.style.width = '0%';
  overlayStatus.textContent = 'Initializing...';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideOverlay() {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function updateOverlayProgress(pct, status) {
  overlayProg.style.width = Math.min(100, pct).toFixed(1) + '%';
  if (status) overlayStatus.textContent = status;
}

// ── File handling ──────────────────────────────────────
function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 20 * 1024 * 1024) {
    alert('File too large. Maximum size is 20 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = formatSize(file.size);
      fileDimsEl.textContent = img.naturalWidth + '×' + img.naturalHeight;
      fileThumbImg.src = e.target.result;
      fileThumbImg.style.display = 'block';

      hide(uploadZone);
      show(fileInfo);
      show(actionBar);
      hide(resultArea);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function resetAll() {
  originalImage = null;
  resultBlob = null;
  maskCanvas = null;
  maskCtx = null;
  origCanvas = null;
  origCtx = null;
  undoStack = [];
  currentMode = 'preview';
  currentTool = 'brush';

  show(uploadZone);
  hide(fileInfo);
  hide(actionBar);
  hide(resultArea);
  hide(refineToolbar);
  hide(refineHint);
  editCanvas.style.display = 'none';
  brushCursor.style.display = 'none';
  fileInput.value = '';
}

// Dropzone events
browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

removeFileBtn.addEventListener('click', resetAll);
newBtn.addEventListener('click', resetAll);

// ── Auto removal ───────────────────────────────────────
async function loadLibrary() {
  if (removeBackgroundFn) return;
  showOverlay('Loading AI Model...', 'First time takes ~30 seconds.<br>The model is cached for future use.');
  updateOverlayProgress(5, 'Downloading library...');
  try {
    const module = await import(LIB_CDN + '/+esm');
    removeBackgroundFn = module.removeBackground || module.default;
    updateOverlayProgress(15, 'Library ready, loading model...');
  } catch (err) {
    hideOverlay();
    alert('Failed to load AI model. Please check your internet connection and try again.\n\n' + err.message);
    throw err;
  }
}

async function runAutoRemoval() {
  if (!originalImage) return;

  try {
    await loadLibrary();
  } catch (e) {
    return;
  }

  showOverlay('Removing Background...', 'AI is processing your image.<br>This may take a few seconds.');
  updateOverlayProgress(15, 'Preparing image...');

  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImage.naturalWidth;
    tempCanvas.height = originalImage.naturalHeight;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(originalImage, 0, 0);

    const imageBlob = await new Promise(r => tempCanvas.toBlob(r, 'image/png'));

    let lastProgress = 15;
    updateOverlayProgress(20, 'Starting AI model...');

    resultBlob = await removeBackgroundFn(imageBlob, {
      model: 'medium',
      output: { format: 'image/png' },
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = 20 + (current / total) * 75;
          if (pct > lastProgress) {
            lastProgress = pct;
            let statusMsg = 'Processing...';
            if (key.includes('fetch') || key.includes('download') || key.includes('load')) {
              statusMsg = 'Downloading model (' + Math.round(pct) + '%)...';
            } else if (key.includes('inference') || key.includes('compute')) {
              statusMsg = 'Running AI inference...';
            }
            updateOverlayProgress(pct, statusMsg);
          }
        }
      }
    });

    updateOverlayProgress(100, 'Done!');
    await new Promise(r => setTimeout(r, 400));
    hideOverlay();

    await buildMaskFromResult();

    hide(actionBar);
    show(resultArea);
    setMode('preview');
    renderPreview();

  } catch (err) {
    hideOverlay();
    console.error('Background removal failed:', err);
    alert('Background removal failed: ' + (err.message || err));
  }
}

autoRemoveBtn.addEventListener('click', runAutoRemoval);
btnReprocess.addEventListener('click', runAutoRemoval);

// ── Mask management ────────────────────────────────────
async function buildMaskFromResult() {
  const w = originalImage.naturalWidth;
  const h = originalImage.naturalHeight;

  origCanvas = document.createElement('canvas');
  origCanvas.width = w;
  origCanvas.height = h;
  origCtx = origCanvas.getContext('2d');
  origCtx.drawImage(originalImage, 0, 0);

  const resultImg = new Image();
  await new Promise((resolve, reject) => {
    resultImg.onload = resolve;
    resultImg.onerror = reject;
    resultImg.src = URL.createObjectURL(resultBlob);
  });

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = w;
  resultCanvas.height = h;
  const rCtx = resultCanvas.getContext('2d');
  rCtx.drawImage(resultImg, 0, 0);
  const resultData = rCtx.getImageData(0, 0, w, h);

  maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.createImageData(w, h);

  for (let i = 0; i < resultData.data.length; i += 4) {
    const alpha = resultData.data[i + 3];
    maskData.data[i] = alpha;
    maskData.data[i + 1] = alpha;
    maskData.data[i + 2] = alpha;
    maskData.data[i + 3] = 255;
  }
  maskCtx.putImageData(maskData, 0, 0);

  URL.revokeObjectURL(resultImg.src);
  undoStack = [];
}

function applyMaskToOriginal() {
  const w = origCanvas.width;
  const h = origCanvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const oCtx = outCanvas.getContext('2d');

  const origData = origCtx.getImageData(0, 0, w, h);
  const mData = maskCtx.getImageData(0, 0, w, h);
  const outData = oCtx.createImageData(w, h);

  for (let i = 0; i < origData.data.length; i += 4) {
    outData.data[i] = origData.data[i];
    outData.data[i + 1] = origData.data[i + 1];
    outData.data[i + 2] = origData.data[i + 2];
    outData.data[i + 3] = mData.data[i];
  }

  oCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

// ── Rendering ──────────────────────────────────────────
function renderPreview() {
  if (!origCanvas || !maskCanvas) return;

  const maxW = canvasWrapper.clientWidth;
  const maxH = window.innerHeight * 0.7;
  let dw = origCanvas.width;
  let dh = origCanvas.height;
  const scale = Math.min(1, maxW / dw, maxH / dh);
  dw = Math.round(dw * scale);
  dh = Math.round(dh * scale);

  previewCanvas.width = dw;
  previewCanvas.height = dh;
  previewCtx.clearRect(0, 0, dw, dh);

  if (currentMode === 'refine') {
    previewCtx.drawImage(originalImage, 0, 0, dw, dh);
  } else {
    const composite = applyMaskToOriginal();
    previewCtx.drawImage(composite, 0, 0, dw, dh);
  }

  editCanvas.width = dw;
  editCanvas.height = dh;

  if (currentMode === 'refine') {
    renderMaskOverlay();
  }
}

function renderMaskOverlay() {
  if (!maskCanvas) return;
  const dw = editCanvas.width;
  const dh = editCanvas.height;
  editCtx.clearRect(0, 0, dw, dh);

  editCtx.drawImage(maskCanvas, 0, 0, dw, dh);
  const overlayData = editCtx.getImageData(0, 0, dw, dh);
  for (let i = 0; i < overlayData.data.length; i += 4) {
    const maskVal = overlayData.data[i];
    if (maskVal < 128) {
      overlayData.data[i] = 220;
      overlayData.data[i + 1] = 50;
      overlayData.data[i + 2] = 50;
      overlayData.data[i + 3] = 120;
    } else {
      overlayData.data[i + 3] = 0;
    }
  }
  editCtx.putImageData(overlayData, 0, 0);
}

// ── Mode switching ─────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  [btnPreview, btnRefine].forEach(b => b.classList.remove('active'));
  if (mode === 'preview') btnPreview.classList.add('active');
  else if (mode === 'refine') btnRefine.classList.add('active');

  if (mode === 'refine') {
    show(refineToolbar);
    show(refineHint);
    editCanvas.style.display = 'block';
    editCanvas.style.cursor = 'none';
  } else {
    hide(refineToolbar);
    hide(refineHint);
    editCanvas.style.display = 'none';
    brushCursor.style.display = 'none';
  }
  renderPreview();
}

btnPreview.addEventListener('click', () => setMode('preview'));
btnRefine.addEventListener('click', () => setMode('refine'));

// ── Manual editing tools ───────────────────────────────
toolBrush.addEventListener('click', () => {
  currentTool = 'brush';
  toolBrush.classList.add('active');
  toolEraser.classList.remove('active');
});
toolEraser.addEventListener('click', () => {
  currentTool = 'eraser';
  toolEraser.classList.add('active');
  toolBrush.classList.remove('active');
});

brushSizeEl.addEventListener('input', () => {
  brushSizeVal.textContent = brushSizeEl.value;
  updateCursorSize();
});
brushSoftEl.addEventListener('input', () => {
  brushSoftVal.textContent = brushSoftEl.value;
});

function updateCursorSize() {
  const sz = parseInt(brushSizeEl.value);
  const rect = editCanvas.getBoundingClientRect();
  const displayScale = rect.width / (maskCanvas ? maskCanvas.width : 1);
  const displaySz = Math.max(4, sz * displayScale);
  brushCursor.style.width = displaySz + 'px';
  brushCursor.style.height = displaySz + 'px';
}

// Brush cursor tracking
editCanvas.addEventListener('mouseenter', () => {
  if (currentMode === 'refine') { brushCursor.style.display = 'block'; updateCursorSize(); }
});
editCanvas.addEventListener('mouseleave', () => {
  brushCursor.style.display = 'none';
  isDrawing = false;
});
editCanvas.addEventListener('mousemove', (e) => {
  brushCursor.style.left = e.clientX + 'px';
  brushCursor.style.top = e.clientY + 'px';
  if (isDrawing) paintOnMask(e);
});

// Drawing
editCanvas.addEventListener('mousedown', (e) => {
  if (currentMode !== 'refine' || !maskCanvas) return;
  isDrawing = true;
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push(maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
  const rect = editCanvas.getBoundingClientRect();
  lastX = (e.clientX - rect.left) / rect.width * maskCanvas.width;
  lastY = (e.clientY - rect.top) / rect.height * maskCanvas.height;
  paintOnMask(e);
});
editCanvas.addEventListener('mouseup', () => {
  if (isDrawing) { isDrawing = false; renderPreview(); }
});

function paintOnMask(e) {
  if (!maskCanvas) return;
  const rect = editCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * maskCanvas.width;
  const y = (e.clientY - rect.top) / rect.height * maskCanvas.height;

  const brushSize = parseInt(brushSizeEl.value);
  const softness = parseInt(brushSoftEl.value) / 100;

  maskCtx.save();
  maskCtx.lineCap = 'round';
  maskCtx.lineJoin = 'round';
  maskCtx.lineWidth = brushSize;

  if (softness > 0) {
    maskCtx.filter = `blur(${Math.round(brushSize * softness * 0.3)}px)`;
  }

  if (currentTool === 'brush') {
    maskCtx.globalCompositeOperation = 'lighter';
    maskCtx.strokeStyle = '#ffffff';
  } else {
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.strokeStyle = '#000000';
  }

  maskCtx.beginPath();
  maskCtx.moveTo(lastX, lastY);
  maskCtx.lineTo(x, y);
  maskCtx.stroke();
  maskCtx.restore();

  lastX = x;
  lastY = y;

  requestAnimationFrame(() => renderPreview());
}

// Undo
toolUndo.addEventListener('click', () => {
  if (undoStack.length > 0 && maskCtx) {
    maskCtx.putImageData(undoStack.pop(), 0, 0);
    renderPreview();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (currentMode !== 'refine') return;
  if (e.key === '[') {
    brushSizeEl.value = Math.max(5, parseInt(brushSizeEl.value) - 5);
    brushSizeVal.textContent = brushSizeEl.value;
    updateCursorSize();
  } else if (e.key === ']') {
    brushSizeEl.value = Math.min(100, parseInt(brushSizeEl.value) + 5);
    brushSizeVal.textContent = brushSizeEl.value;
    updateCursorSize();
  } else if (e.key === 'b' || e.key === 'B') {
    toolBrush.click();
  } else if (e.key === 'e' || e.key === 'E') {
    toolEraser.click();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    toolUndo.click();
  }
});

// Touch support
editCanvas.addEventListener('touchstart', (e) => {
  if (currentMode !== 'refine' || !maskCanvas) return;
  e.preventDefault();
  const touch = e.touches[0];
  isDrawing = true;
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push(maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
  const rect = editCanvas.getBoundingClientRect();
  lastX = (touch.clientX - rect.left) / rect.width * maskCanvas.width;
  lastY = (touch.clientY - rect.top) / rect.height * maskCanvas.height;
}, { passive: false });

editCanvas.addEventListener('touchmove', (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  const touch = e.touches[0];
  paintOnMask({ clientX: touch.clientX, clientY: touch.clientY });
}, { passive: false });

editCanvas.addEventListener('touchend', () => {
  if (isDrawing) { isDrawing = false; renderPreview(); }
});

// ── Download ───────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!origCanvas || !maskCanvas) return;
  const resultCanvas = applyMaskToOriginal();
  resultCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (fileNameEl.textContent || 'image').replace(/\.[^.]+$/, '');
    a.download = baseName + '-no-bg.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
});

// ── Window resize ──────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (resultArea && !resultArea.classList.contains('hidden')) renderPreview();
  }, 200);
});
