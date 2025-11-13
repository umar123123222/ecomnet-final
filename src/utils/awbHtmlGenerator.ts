/**
 * Generates printable HTML for multiple AWB labels
 * Layout: 3 AWBs per A4 page with page-break control
 */
export function generateAWBPrintHTML(imageDataArray: string[]): string {
  const awbItems = imageDataArray
    .map((base64Image) => `
      <div class="awb-item">
        <img src="data:image/png;base64,${base64Image}" alt="AWB Label" />
      </div>
    `)
    .join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AWB Labels</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
    }

    .awb-grid {
      width: 100%;
      max-width: 210mm; /* A4 width */
      margin: 0 auto;
      background: white;
      padding: 10mm;
    }

    .awb-item {
      width: 100%;
      margin-bottom: 5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e0e0e0;
      padding: 5mm;
      background: white;
    }

    .awb-item img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    @media print {
      body {
        background: white;
      }

      .awb-grid {
        padding: 0;
        max-width: 100%;
      }

      .awb-item {
        height: 33.33%;
        page-break-inside: avoid;
        margin-bottom: 0;
        border: none;
        padding: 2mm;
      }

      .awb-item img {
        max-height: 100%;
        object-fit: contain;
      }

      @page {
        size: A4;
        margin: 10mm;
      }
    }

    @media screen {
      .no-print {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
      }

      .print-button {
        background: #2563eb;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: background 0.2s;
      }

      .print-button:hover {
        background: #1d4ed8;
      }
    }

    @media print {
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-button" onclick="window.print()">Print AWBs</button>
  </div>
  
  <div class="awb-grid">
    ${awbItems}
  </div>

  <script>
    // Auto-print on load (optional)
    // window.onload = () => window.print();
  </script>
</body>
</html>
  `.trim();
}

/**
 * Opens the generated HTML in a new window for printing
 */
export function openAWBPrintWindow(imageDataArray: string[]): void {
  const html = generateAWBPrintHTML(imageDataArray);
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    throw new Error('Failed to open print window. Please allow popups for this site.');
  }

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Downloads the HTML as a file
 */
export function downloadAWBHTML(imageDataArray: string[], filename: string = 'awb-labels.html'): void {
  const html = generateAWBPrintHTML(imageDataArray);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}
