export function base64ToBlob(base64: string, contentType = 'application/pdf'): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function createObjectUrlFromLabelFile(file: { url?: string; base64?: string; contentType?: string }) {
  if (file?.url) return { objectUrl: file.url, revoke: () => {} };
  if (file?.base64) {
    const blob = base64ToBlob(file.base64, file.contentType ?? 'application/pdf');
    const objectUrl = URL.createObjectURL(blob);
    return { objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
  }
  return { objectUrl: '', revoke: () => {} };
}

export function printPdfFromIframe(pdfUrl: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = pdfUrl;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 100);
  };
}

export async function downloadPdf(filename: string, file: { url?: string; base64?: string; contentType?: string }) {
  if (file?.url) {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  if (file?.base64) {
    const blob = base64ToBlob(file.base64, file.contentType ?? 'application/pdf');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
