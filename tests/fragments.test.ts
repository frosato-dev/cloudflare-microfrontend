import { describe, it, expect } from 'vitest';
import { render as renderHeader } from '../packages/fragments/fragment-header/src/entry-server';
import { render as renderProduct } from '../packages/fragments/fragment-product/src/entry-server';
import { routes } from '../packages/apps/front-office/src/router';
import { layouts } from '../packages/apps/front-office/src/layouts/index';
import { middlewareRegistry } from '../packages/apps/front-office/src/middleware';
import { matchRoute, handleRequest, type FragmentResponse } from '@meta-framework/core';

describe('fragment SSR', () => {
  it('header fragment renders HTML', async () => {
    const result = await renderHeader();
    expect(result.html).toContain('Back Market');
    expect(result.html).toContain('Cart');
  });

  it('product fragment renders with props', async () => {
    const url = 'http://localhost:3000/fragment?id=iphone-15';
    const result = await renderProduct(new Request(url));
    expect(result.html).toContain('iphone-15');
    expect(result.html).toContain('$699');
  });
});

describe('router', () => {
  it('matches index route', () => {
    const route = matchRoute(routes, '/');
    expect(route).toBeTruthy();
    expect(route!.fragments).toContain('header');
  });

  it('matches product route with param', () => {
    const route = matchRoute(routes, '/product/galaxy-s24');
    expect(route).toBeTruthy();
    expect(route!.props.id).toBe('galaxy-s24');
    expect(route!.fragments).toContain('product');
  });

  it('returns null for unknown routes', () => {
    expect(matchRoute(routes, '/unknown')).toBeNull();
  });
});

describe('shell assembly', () => {
  const config = {
    routes,
    layouts,
    middlewareRegistry,
    streamLayoutFn: () => ({ before: '', after: '' }),
  };

  it('renders full page with fragments', async () => {
    const mockFetcher = async (id: string, _req: Request, _props: Record<string, string> = {}): Promise<FragmentResponse> => {
      if (id === 'header') return { html: '<header>Mock Header</header>' };
      if (id === 'product') return { html: '<div>Mock Product</div>' };
      return { html: '' };
    };

    const request = new Request('http://localhost:3000/');
    const response = await handleRequest(request, mockFetcher, config, { isDev: true });
    const html = await response.text();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('data-fragment="header"');
    expect(html).toContain('Mock Header');
  });

  it('returns 404 for unknown routes', async () => {
    const request = new Request('http://localhost:3000/nope');
    const response = await handleRequest(request, async (_id, _req, _props = {}) => ({ html: '' }), config, { isDev: true });
    expect(response.status).toBe(404);
  });
});
