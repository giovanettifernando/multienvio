import assert from 'node:assert';
import test from 'node:test';
import { base64ToBlob, createObjectUrlFromLabelFile, downloadPdf, printPdfFromIframe } from '@/shared/utils/pdf';

// Mock minimal DOM APIs
const created: any[] = [];
const appended: any[] = [];
(globalThis as any).document = {
  createElement: (tag: string) => {
    const el: any = { tag, style: {}, clickCalled: false };
    if (tag === 'iframe') {
      el.contentWindow = { focus: () => {}, print: () => {} };
      el.onload = null;
    }
    if (tag === 'a') {
      el.click = () => {
        el.clickCalled = true;
      };
    }
    created.push(el);
    return el;
  },
  body: {
    appendChild: (el: any) => appended.push(el),
    removeChild: (el: any) => {
      const idx = appended.indexOf(el);
      if (idx >= 0) appended.splice(idx, 1);
    },
  },
};
(globalThis as any).URL = {
  created: [] as string[],
  revoked: [] as string[],
  createObjectURL: (blob: any) => {
    const url = `mock://blob/${blob?.size ?? 0}`;
    (globalThis as any).URL.created.push(url);
    return url;
  },
  revokeObjectURL: (url: string) => {
    (globalThis as any).URL.revoked.push(url);
  },
};
(globalThis as any).atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');

test.describe('utils/pdf', () => {
  test('base64ToBlob converte corretamente', () => {
    const blob = base64ToBlob(Buffer.from('hello').toString('base64'));
    assert.strictEqual(blob instanceof Blob, true);
  });

  test('createObjectUrlFromLabelFile usa url direta ou base64 e revoga', () => {
    const direct = createObjectUrlFromLabelFile({ url: 'http://example.com/file.pdf' });
    assert.strictEqual(direct.objectUrl, 'http://example.com/file.pdf');
    let revoked = false;
    direct.revoke();
    // base64 path
    const withBase64 = createObjectUrlFromLabelFile({ base64: Buffer.from('pdf').toString('base64') });
    assert.ok(withBase64.objectUrl.startsWith('mock://blob/'));
    withBase64.revoke();
  });

  test('printPdfFromIframe cria iframe e aciona onload', async () => {
    printPdfFromIframe('http://pdf');
    const iframe = created.find((el) => el.tag === 'iframe');
    assert.ok(iframe);
    // simulate onload
    iframe.onload?.();
    await new Promise((r) => setTimeout(r, 120));
    assert.strictEqual(appended.includes(iframe), false);
  });

  test('downloadPdf baixa via url ou base64', async () => {
    await downloadPdf('file.pdf', { url: 'http://example.com/file.pdf' });
    const anchorUrl = created.find((el) => el.tag === 'a' && el.href === 'http://example.com/file.pdf');
    assert.ok(anchorUrl?.clickCalled);

    created.length = 0;
    appended.length = 0;
    await downloadPdf('file.pdf', { base64: Buffer.from('pdf').toString('base64') });
    const anchorBase64 = created.find((el) => el.tag === 'a' && el.href?.startsWith('mock://blob/'));
    assert.ok(anchorBase64?.clickCalled);
    assert.ok((globalThis as any).URL.revoked.length > 0);
  });
});
