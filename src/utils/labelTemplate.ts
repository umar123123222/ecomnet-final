import { LabelData } from '@/types/production';
import { generateBarcode } from './barcodeGenerator';

/**
 * Generate HTML template for label printing
 */
export const generateLabelHTML = async (labelData: LabelData): Promise<string> => {
  let barcodeImage = '';
  
  if (labelData.includeBarcode && labelData.barcode) {
    try {
      barcodeImage = await generateBarcode(labelData.barcode, labelData.barcodeFormat);
    } catch (error) {
      console.error('Failed to generate barcode:', error);
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: 4in 3in;
          margin: 0.2in;
        }
        
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          width: 4in;
          height: 3in;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        
        .label {
          width: 100%;
          text-align: center;
          padding: 10px;
          box-sizing: border-box;
        }
        
        .product-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 8px;
          word-wrap: break-word;
        }
        
        .sku {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
        }
        
        .barcode-container {
          margin: 10px 0;
        }
        
        .barcode-image {
          max-width: 100%;
          height: auto;
        }
        
        .details {
          font-size: 11px;
          margin-top: 8px;
          line-height: 1.4;
        }
        
        .details-row {
          margin: 3px 0;
        }
        
        .label-text {
          font-weight: bold;
        }
        
        .packaging-details {
          font-size: 10px;
          margin-top: 8px;
          font-style: italic;
          color: #555;
        }
        
        .price {
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
          color: #000;
        }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="product-name">${labelData.productName}</div>
        <div class="sku">SKU: ${labelData.sku}</div>
        
        ${barcodeImage ? `
          <div class="barcode-container">
            <img src="${barcodeImage}" alt="Barcode" class="barcode-image" />
          </div>
        ` : ''}
        
        <div class="details">
          ${labelData.includeBatchInfo && labelData.batchNumber ? `
            <div class="details-row">
              <span class="label-text">Batch:</span> ${labelData.batchNumber}
            </div>
          ` : ''}
          
          ${labelData.includeBatchInfo && labelData.productionDate ? `
            <div class="details-row">
              <span class="label-text">Mfg:</span> ${new Date(labelData.productionDate).toLocaleDateString()}
            </div>
          ` : ''}
          
          ${labelData.includeExpiryDate && labelData.expiryDate ? `
            <div class="details-row">
              <span class="label-text">Exp:</span> ${new Date(labelData.expiryDate).toLocaleDateString()}
            </div>
          ` : ''}
        </div>
        
        ${labelData.packagingDetails ? `
          <div class="packaging-details">${labelData.packagingDetails}</div>
        ` : ''}
        
        ${labelData.includePrice && labelData.price ? `
          <div class="price">Rs. ${labelData.price.toFixed(2)}</div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};

/**
 * Print labels using browser print dialog
 */
export const printLabels = async (htmlContent: string) => {
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    throw new Error('Failed to open print window. Please allow popups.');
  }
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.print();
    // Don't close automatically - let user close after printing
  };
};
