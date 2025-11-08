/**
 * Utility functions for handling courier label downloads
 */

export async function downloadCourierLabel(
  labelData: string | null,
  labelUrl: string | null,
  labelFormat: string,
  trackingId: string
) {
  try {
    if (labelData) {
      // Handle base64 encoded data
      if (labelFormat === 'pdf') {
        downloadBase64AsPDF(labelData, `label-${trackingId}.pdf`);
      } else if (labelFormat === 'png') {
        downloadBase64AsImage(labelData, `label-${trackingId}.png`);
      } else if (labelFormat === 'html') {
        downloadHTMLContent(atob(labelData), `label-${trackingId}.html`);
      }
    } else if (labelUrl) {
      // Handle URL
      if (labelFormat === 'url' || labelUrl.startsWith('http')) {
        window.open(labelUrl, '_blank');
      } else if (labelUrl.startsWith('data:')) {
        // Data URI
        const link = document.createElement('a');
        link.href = labelUrl;
        link.download = `label-${trackingId}.${labelFormat}`;
        link.click();
      }
    } else {
      throw new Error('No label data or URL available');
    }
  } catch (error) {
    console.error('Error downloading label:', error);
    throw error;
  }
}

function downloadBase64AsPDF(base64Data: string, filename: string) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBase64AsImage(base64Data: string, filename: string) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadHTMLContent(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadMultipleLabels(dispatches: any[]) {
  const errors: string[] = [];
  
  for (const dispatch of dispatches) {
    try {
      if (dispatch.label_data || dispatch.label_url) {
        await downloadCourierLabel(
          dispatch.label_data,
          dispatch.label_url,
          dispatch.label_format || 'pdf',
          dispatch.tracking_id
        );
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      errors.push(`${dispatch.tracking_id}: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Failed to download ${errors.length} labels:\n${errors.join('\n')}`);
  }
}
