const stored: Record<string, Buffer> = {};

export async function upload(path: string, content: Buffer) {
  stored[path] = content;
  return { url: `mock://storage/${path}` };
}

export async function get(path: string) {
  return stored[path];
}

export function resetStorage() {
  for (const key of Object.keys(stored)) {
    delete stored[key];
  }
}
