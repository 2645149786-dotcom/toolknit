pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const dropzone = $('#dropzone');
  const fileInput = $('#file-input');
  const browseBtn = $('#browse-btn');
  const fileCard = $('#file-card');
  const fileNameEl = $('#file-name');
  const fileDetailsEl = $('#file-details');
  const removeBtn = $('#remove-btn');
  const settings = $('#settings');
  const resolutionSelect = $('#resolution-select');
  const convertBtn = $('#convert-btn');
  const cancelBtn = $('#cancel-btn');
  const resetBtn = $('#reset-btn');
  const statusMessage = $('#status-message');
  const progressSection = $('#progress-section');
  const progressBar = $('#progress-bar');
  const progressText = $('#progress-text');
  const progressDetail = $('#progress-detail');
  const resultsSection = $('#results-section');
  const resultsGrid = $('#results-grid');
  const downloadAllBtn = $('#download-all-btn');

  let aiFile = null;
  let pdfDoc = null;
  let totalPages = 0;
  let convertedImages = [];
  let isConverting = false;
  let cancelRequested = false;
  let blobUrls = [];

  function show(element) {
    if (element) element.classList.remove('hidden');
  }

  function hide(element) {
    if (element) element.classList.add('hidden');
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function clearBlobUrls() {
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
    blobUrls = [];
  }

  function setStatus(message, type) {
    if (!message) {
      hide(statusMessage);
      statusMessage.textContent = '';
      statusMessage.className = 'status hidden';
      return;
    }

    statusMessage.textContent = message;
    statusMessage.className = 'status';
    if (type === 'error') statusMessage.classList.add('error');
    if (type === 'success') statusMessage.classList.add('success');
    show(statusMessage);
  }

  function updateProgress(current, total, detail) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${current} / ${total} artboard${total === 1 ? '' : 's'}`;
    progressDetail.textContent = detail;
  }

  async function handleFile(file) {
    if (!file) return;

    setStatus('', '');

    if (!file.name.toLowerCase().endsWith('.ai')) {
      setStatus('Only Adobe Illustrator (.ai) files are supported.', 'error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setStatus('File exceeds the 50 MB limit. Please choose a smaller AI file.', 'error');
      return;
    }

    aiFile = file;
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = `${formatBytes(file.size)} · Parsing…`;
    show(fileCard);
    show(settings);
    hide(resultsSection);
    hide(progressSection);
    hide(resetBtn);
    resultsGrid.innerHTML = '';
    convertedImages = [];
    clearBlobUrls();
    convertBtn.disabled = true;

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      totalPages = pdfDoc.numPages;

      if (!totalPages) {
        setStatus('This AI file does not contain any renderable artboards.', 'error');
        resetAll();
        return;
      }

      fileDetailsEl.textContent = `${formatBytes(file.size)} · ${totalPages} artboard${totalPages === 1 ? '' : 's'}`;
      convertBtn.disabled = false;
      setStatus('File parsed successfully. Choose a resolution and start conversion.', 'success');
    } catch (error) {
      console.error('Failed to parse AI file:', error);
      const message = error && String(error.message || '').includes('Invalid PDF')
        ? 'This AI file does not include a PDF-compatible layer. Save it from Illustrator with PDF compatibility enabled.'
        : 'Failed to parse the AI file. It may be corrupted or use a legacy Illustrator format.';
      setStatus(message, 'error');
      resetAll(true);
    }
  }

  async function startConversion() {
    if (!pdfDoc || isConverting) return;

    isConverting = true;
    cancelRequested = false;
    convertedImages = [];
    clearBlobUrls();
    resultsGrid.innerHTML = '';
    show(progressSection);
    show(resultsSection);
    show(cancelBtn);
    hide(resetBtn);
    convertBtn.disabled = true;
    downloadAllBtn.disabled = true;
    setStatus('', '');

    const baseName = aiFile.name.replace(/\.ai$/i, '');
    const scale = Number.parseFloat(resolutionSelect.value || '2');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    updateProgress(0, totalPages, 'Preparing conversion…');

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (cancelRequested) break;

      updateProgress(pageNumber - 1, totalPages, `Rendering artboard ${pageNumber} of ${totalPages}…`);

      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.clearRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Canvas export returned an empty blob.');

        const url = URL.createObjectURL(blob);
        blobUrls.push(url);

        const fileName = totalPages === 1
          ? `${baseName}.png`
          : `${baseName}_artboard_${pageNumber}.png`;

        const imageData = {
          name: fileName,
          blob,
          url,
          pageNumber,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height)
        };

        convertedImages.push(imageData);
        appendResultCard(imageData);
        page.cleanup();
      } catch (error) {
        console.error(`Failed to render artboard ${pageNumber}:`, error);
        appendFailureCard(pageNumber, error);
      }

      updateProgress(pageNumber, totalPages, `Processed ${pageNumber} of ${totalPages} artboards.`);

      if (pageNumber % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    isConverting = false;
    hide(cancelBtn);
    show(resetBtn);
    convertBtn.disabled = false;

    if (cancelRequested) {
      setStatus(`Conversion cancelled. ${convertedImages.length} image${convertedImages.length === 1 ? '' : 's'} generated before stopping.`, 'error');
    } else if (convertedImages.length > 0) {
      setStatus(`Conversion complete. ${convertedImages.length} PNG image${convertedImages.length === 1 ? '' : 's'} ready for download.`, 'success');
    } else {
      setStatus('No images were generated from this file.', 'error');
    }

    downloadAllBtn.disabled = convertedImages.length === 0;
  }

  function appendResultCard(imageData) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-preview">
        <img src="${imageData.url}" alt="Artboard ${imageData.pageNumber}" loading="lazy">
      </div>
      <div class="card-body">
        <strong>${imageData.name}</strong>
        <span>${imageData.width} × ${imageData.height} px</span>
        <div class="actions">
          <button type="button" class="btn-secondary">Download PNG</button>
        </div>
      </div>
    `;

    card.querySelector('button').addEventListener('click', () => downloadSingle(imageData));
    resultsGrid.appendChild(card);
  }

  function appendFailureCard(pageNumber) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-preview" style="padding: 20px; text-align: center; color: rgba(255,255,255,.45);">
        Artboard ${pageNumber}<br>failed to render
      </div>
      <div class="card-body">
        <strong>Artboard ${pageNumber}</strong>
        <span>The renderer could not export this artboard.</span>
      </div>
    `;
    resultsGrid.appendChild(card);
  }

  function downloadSingle(imageData) {
    const link = document.createElement('a');
    link.href = imageData.url;
    link.download = imageData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function downloadAll() {
    if (!convertedImages.length) return;

    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = 'Packing ZIP…';

    try {
      const zip = new JSZip();
      const folder = zip.folder('png-images');

      convertedImages.forEach((image) => {
        folder.file(image.name, image.blob);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      }, (meta) => {
        downloadAllBtn.textContent = `Packing ZIP… ${Math.round(meta.percent)}%`;
      });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${aiFile ? aiFile.name.replace(/\.ai$/i, '') : 'converted'}-png.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate ZIP:', error);
      setStatus('Failed to generate ZIP download.', 'error');
    }

    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = 'Download All (ZIP)';
  }

  function resetAll(keepStatus) {
    aiFile = null;
    pdfDoc = null;
    totalPages = 0;
    convertedImages = [];
    isConverting = false;
    cancelRequested = false;
    clearBlobUrls();
    fileInput.value = '';
    resultsGrid.innerHTML = '';
    progressBar.style.width = '0%';
    progressText.textContent = '0 / 0 artboards';
    progressDetail.textContent = 'Preparing…';
    hide(fileCard);
    hide(settings);
    hide(progressSection);
    hide(resultsSection);
    hide(cancelBtn);
    hide(resetBtn);
    convertBtn.disabled = true;
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = 'Download All (ZIP)';
    if (!keepStatus) setStatus('', '');
  }

  browseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const files = event.dataTransfer.files;
    if (files && files[0]) handleFile(files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  removeBtn.addEventListener('click', () => resetAll());
  convertBtn.addEventListener('click', startConversion);
  cancelBtn.addEventListener('click', () => {
    cancelRequested = true;
    setStatus('Cancellation requested… finishing the current artboard first.', 'error');
  });
  resetBtn.addEventListener('click', () => resetAll());
  downloadAllBtn.addEventListener('click', downloadAll);

  window.addEventListener('beforeunload', clearBlobUrls);
})();
