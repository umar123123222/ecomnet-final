/**
 * Convert PDF pages to images using canvas
 * This utility is used client-side to convert individual PDF pages to PNG images
 */

// Use dynamic import to avoid bundling issues
let pdfjsLib: any = null;

async function loadPdfJs() {
  if (!pdfjsLib) {
    // @ts-ignore - pdfjs is loaded from CDN
    pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (!pdfjsLib) {
      throw new Error('PDF.js library not loaded. Add script tag: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return pdfjsLib;
}

/**
 * Convert a single PDF page to PNG image (base64)
 */
export async function pdfPageToImage(pdfBase64: string): Promise<string> {
  const pdfjs = await loadPdfJs();
  
  // Convert base64 to binary
  const pdfData = atob(pdfBase64);
  const pdfArray = new Uint8Array(pdfData.length);
  for (let i = 0; i < pdfData.length; i++) {
    pdfArray[i] = pdfData.charCodeAt(i);
  }

  // Load the PDF
  const loadingTask = pdfjs.getDocument({ data: pdfArray });
  const pdf = await loadingTask.promise;

  // Get the first page
  const page = await pdf.getPage(1);

  // Set scale for good quality
  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  // Render PDF page to canvas
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  // Convert canvas to PNG base64
  return canvas.toDataURL('image/png').split(',')[1]; // Remove "data:image/png;base64," prefix
}

/**
 * Convert multiple PDF pages to PNG images
 */
export async function convertPDFPagesToImages(pdfBase64Array: string[]): Promise<string[]> {
  const images: string[] = [];
  
  for (const pdfBase64 of pdfBase64Array) {
    try {
      const imageBase64 = await pdfPageToImage(pdfBase64);
      images.push(imageBase64);
    } catch (error) {
      console.error('Error converting PDF page to image:', error);
      // Continue with other pages even if one fails
    }
  }
  
  return images;
}

/**
 * Load PDF.js library dynamically
 */
export function loadPdfJsLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    // @ts-ignore
    if (window['pdfjs-dist/build/pdf']) {
      resolve();
      return;
    }

    // Create script tags
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}
