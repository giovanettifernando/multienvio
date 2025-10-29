/**
 * Mock de upload que retorna uma URL data: ou uma URL simulada
 */
export async function uploadFile(file: File): Promise<string> {
  if (typeof window === 'undefined' || typeof FileReader === 'undefined') {
    const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
    const randomId = Math.random().toString(36).slice(2, 10);
    return `/uploads/${randomId}-${safeName}`;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        const blob = new Blob([reader.result as ArrayBuffer]);
        resolve(URL.createObjectURL(blob));
      }
    };
    reader.onerror = () => {
      reject(new Error('Falha ao carregar arquivo'));
    };
    reader.readAsDataURL(file);
  });
}
