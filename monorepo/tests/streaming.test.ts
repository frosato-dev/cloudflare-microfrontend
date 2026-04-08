import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { handleRequest, toRouteEntries, type FragmentResponse } from 'framework';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): Promise<string> {
  const { value, done } = await reader.read();
  if (done) return '';
  return decoder.decode(value);
}

/** Drain all remaining chunks into a single string */
async function drainReader(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): Promise<string> {
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

// Layout with header + footer fragment placeholders
const TwoFragmentLayout = defineComponent({
  setup(_, { slots }) {
    return () => h('div', [
      h('div', { 'data-fragment': 'header', 'data-props': '{}', 'data-allow-mismatch': '' }),
      h('main', null, slots.default?.()),
      h('div', { 'data-fragment': 'footer', 'data-props': '{}', 'data-allow-mismatch': '' }),
    ]);
  },
});

const Page = defineComponent({ render: () => h('p', 'page content') });

const config = {
  routes: toRouteEntries([{ path: '/', component: Page, layout: 'default' }]),
  middlewareRegistry: {},
  layouts: { default: TwoFragmentLayout },
  document: { title: 'Stream Test' },
};

const request = () => new Request('http://localhost:3000/');

describe('streaming', () => {
  it('flushes shell assets in <head> before SSR and fragments', async () => {
    const header = deferred<FragmentResponse>();
    const footer = deferred<FragmentResponse>();

    const fetcher = async (id: string) => {
      if (id === 'header') return header.promise;
      return footer.promise;
    };

    const response = await handleRequest(request(), fetcher, config);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // First chunk: shell assets flushed before SSR runs
    const head = await readChunk(reader, decoder);
    expect(head).toContain('<!DOCTYPE html>');
    expect(head).toContain('<head>');
    expect(head).toContain('<title>Stream Test</title>');
    expect(head).toContain('<script type="module" src="/assets/shell.js"');
    expect(head).toContain('<link rel="modulepreload" href="/assets/vue.js"');
    expect(head).toContain('<link rel="stylesheet" href="/assets/shell.css"');
    // Fragment assets NOT in first chunk (SSR hasn't run yet)
    expect(head).not.toContain('fragment-header');
    expect(head).not.toContain('HEADER_HTML');
    // </head> not closed yet — fragment tags come after SSR
    expect(head).not.toContain('</head>');

    // Now resolve fragments and drain
    header.resolve({ html: 'HEADER_HTML' });
    footer.resolve({ html: 'FOOTER_HTML' });
    const rest = await drainReader(reader, decoder);
    // Fragment assets appear after SSR, before body
    expect(rest).toContain('fragment-header');
    expect(rest).toContain('fragment-footer');
    expect(rest).toContain('</head>');
    expect(rest).toContain('HEADER_HTML');
    expect(rest).toContain('FOOTER_HTML');
  });

  it('streams fragments in document order regardless of resolve order', async () => {
    const header = deferred<FragmentResponse>();
    const footer = deferred<FragmentResponse>();

    const fetcher = async (id: string) => {
      if (id === 'header') return header.promise;
      return footer.promise;
    };

    const response = await handleRequest(request(), fetcher, config);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Skip head
    await readChunk(reader, decoder);

    // Resolve footer FIRST, then header — header should still appear first in output
    footer.resolve({ html: 'FOOTER_CONTENT' });
    // Give microtask a chance — footer resolved but header blocks streaming
    await new Promise((r) => setTimeout(r, 10));
    header.resolve({ html: 'HEADER_CONTENT' });

    const body = await drainReader(reader, decoder);
    const headerIdx = body.indexOf('HEADER_CONTENT');
    const footerIdx = body.indexOf('FOOTER_CONTENT');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(footerIdx);
  });

  it('footer delay does not block header streaming', async () => {
    const header = deferred<FragmentResponse>();
    const footer = deferred<FragmentResponse>();

    const fetcher = async (id: string) => {
      if (id === 'header') return header.promise;
      return footer.promise;
    };

    const response = await handleRequest(request(), fetcher, config);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Skip <head>
    await readChunk(reader, decoder);

    // Resolve header immediately — it should stream without waiting for footer
    header.resolve({ html: 'HEADER_FAST' });
    // Let microtasks flush so the stream writes the header fragment
    await new Promise((r) => setTimeout(r, 10));

    // Read all available chunks (static parts + header fragment)
    let streamed = '';
    // readChunk is non-blocking per chunk; read until we see header content
    for (let i = 0; i < 10; i++) {
      const c = await readChunk(reader, decoder);
      if (!c) break;
      streamed += c;
      if (streamed.includes('HEADER_FAST')) break;
    }
    expect(streamed).toContain('HEADER_FAST');
    expect(streamed).not.toContain('FOOTER');

    // Now resolve footer
    footer.resolve({ html: 'FOOTER_SLOW' });
    const rest = await drainReader(reader, decoder);
    expect(rest).toContain('FOOTER_SLOW');
  });

  it('inlines fragment CSS at fragment position', async () => {
    const fetcher = async (id: string): Promise<FragmentResponse> => {
      if (id === 'header') return { html: '<nav>Header</nav>', css: '.header{color:red}' };
      return { html: '<footer>Footer</footer>' };
    };

    const response = await handleRequest(request(), fetcher, config);
    const html = await response.text();

    // CSS <style> should appear right before the fragment's opening tag
    const cssIdx = html.indexOf('<style>.header{color:red}</style>');
    const fragIdx = html.indexOf('data-fragment="header"');
    expect(cssIdx).toBeGreaterThan(-1);
    expect(fragIdx).toBeGreaterThan(-1);
    expect(cssIdx).toBeLessThan(fragIdx);

    // Footer has no CSS — no extra <style> before it
    const footerCssCount = (html.match(/<style>.*?<\/style>/g) || [])
      .filter((s) => s.includes('footer')).length;
    expect(footerCssCount).toBe(0);
  });

  it('returns Link headers with shell assets for early discovery', async () => {
    const fetcher = async (): Promise<FragmentResponse> => ({ html: '<p>ok</p>' });
    const response = await handleRequest(request(), fetcher, config);
    const linkHeader = response.headers.get('Link')!;

    expect(linkHeader).toContain('rel=preload; as=style');
    expect(linkHeader).toContain('rel=modulepreload');
    expect(linkHeader).toContain('shell.css');
    expect(linkHeader).toContain('shell.js');
    expect(linkHeader).toContain('vue.js');
    // Fragment assets not in Link headers (discovered after SSR)
    expect(linkHeader).not.toContain('fragment-');
  });

  it('places all scripts in <head>, not after </div> body', async () => {
    const fetcher = async (): Promise<FragmentResponse> => ({ html: '<p>ok</p>' });
    const response = await handleRequest(request(), fetcher, config);
    const html = await response.text();

    // Shell + fragment scripts should be inside <head>
    const headEnd = html.indexOf('</head>');
    const shellScriptIdx = html.indexOf('<script type="module" src="/assets/shell.');
    const fragScriptIdx = html.indexOf('<script type="module" src="/assets/fragment-');
    expect(shellScriptIdx).toBeGreaterThan(-1);
    expect(shellScriptIdx).toBeLessThan(headEnd);
    expect(fragScriptIdx).toBeGreaterThan(-1);
    expect(fragScriptIdx).toBeLessThan(headEnd);

    // No scripts after #app closing div
    const appClose = html.indexOf('</div>\n</body>');
    const afterApp = html.slice(appClose);
    expect(afterApp).not.toContain('<script type="module"');
  });
});
