import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { handleRequest, type HandleRequestConfig } from './request-handler.js';
import { isolateFetcher } from './isolation.js';
import { toRouteEntries } from './router.js';
import type { FragmentFetcher } from './types.js';

const Fragment = (id: string) =>
  h('div', { 'data-fragment': id, 'data-props': '{}', 'data-allow-mismatch': '' });
const Layout = defineComponent({ setup: (_, { slots }) => () => [Fragment('header'), h('main', slots.default?.()), Fragment('footer')] });
const Page = defineComponent({ setup: () => () => h('h1', 'page') });

function setup(fetcher: FragmentFetcher, extra: Partial<HandleRequestConfig> = {}) {
  const config: HandleRequestConfig = {
    routes: toRouteEntries([{ path: '/', component: Page }]),
    middlewareRegistry: {},
    layouts: { default: Layout },
    document: { title: 't' },
    ...extra,
  };
  return handleRequest(new Request('https://x.test/'), fetcher, config).then((r) => r.text());
}

const ok = (id: string) => ({ html: `<p>${id}</p>`, version: `${id}@1`, assets: { js: `/_fragments/${id}/a.js`, css: [] } });

describe('fragment isolation', () => {
  it('renders an empty slot for a failing fragment and reports it', async () => {
    const onFragmentError = vi.fn();
    const fetcher = isolateFetcher(async (id) => {
      if (id === 'footer') throw new Error('boom');
      return ok(id);
    });
    const html = await setup(fetcher, { onFragmentError });
    expect(html).toContain('<p>header</p>');
    expect(html).toContain('data-fragment-error="boom"');
    expect(html).not.toContain('/_fragments/footer/');
    expect(html.trimEnd()).toMatch(/<\/html>$/);
    expect(onFragmentError).toHaveBeenCalledWith('footer', 'boom');
  });

  it('times out a slow fragment without stalling the page', async () => {
    const fetcher = isolateFetcher((id) => (id === 'header' ? new Promise(() => {}) : Promise.resolve(ok(id))), 50);
    const html = await setup(fetcher);
    expect(html).toContain('data-fragment-error="timeout after 50ms"');
    expect(html).toContain('<p>footer</p>');
  });

  it('client-side fallback uses last known assets of the failed fragment', async () => {
    const knownAssets = new Map([['footer', { js: '/_fragments/footer/old.js', css: ['/_fragments/footer/old.css'] }]]);
    const fetcher = isolateFetcher(async (id) => (id === 'footer' ? { html: '', error: 'HTTP 500' } : ok(id)));
    const html = await setup(fetcher, { knownAssets });
    expect(html).toMatch(/data-fragment-error="HTTP 500"><link rel="stylesheet" href="\/_fragments\/footer\/old.css"><\/div>/);
    expect(html).toContain('<script type="module" src="/_fragments/footer/old.js">');
  });

  it('closes the stream when the shell render itself throws', async () => {
    const Broken = defineComponent({ setup: () => { throw new Error('layout bug'); } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = await setup(async (id) => ok(id), { layouts: { default: Broken } });
    expect(html).toContain('<head>');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
