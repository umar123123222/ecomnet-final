import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

/**
 * Generate barcode as data URL
 */
export const generateBarcode = async (
  value: string,
  format: string = 'CODE128'
): Promise<string> => {
  const canvas = document.createElement('canvas');
  
  try {
    if (format === 'QR') {
      await QRCode.toCanvas(canvas, value, {
        width: 200,
        margin: 1,
      });
    } else {
      JsBarcode(canvas, value, {
        format: format,
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 10,
      });
    }
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw new Error(`Failed to generate barcode: ${error}`);
  }
};

/**
 * Generate random barcode value
 */
export const generateBarcodeValue = (prefix: string = ''): string => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return prefix ? `${prefix}${timestamp}${random}` : `${timestamp}${random}`;
};

/**
 * Validate barcode format
 */
export const validateBarcodeFormat = (value: string, format: string): boolean => {
  switch (format) {
    case 'CODE128':
      return value.length > 0;
    case 'EAN13':
      return /^\d{13}$/.test(value);
    case 'EAN8':
      return /^\d{8}$/.test(value);
    case 'UPC':
      return /^\d{12}$/.test(value);
    case 'QR':
      return value.length > 0;
    default:
      return false;
  }
};
