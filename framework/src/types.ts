import type { Component } from 'vue';

export type LazyComponent = () => Promise<{ default: Component }>;

export interface FragmentAssets {
  js?: string;
  css: string[];
}

/** Inlined into the fragment worker at build time */
export interface FragmentBuildInfo {
  version: string;
  vue: string;
  assets: FragmentAssets;
}

export interface FragmentResponse extends Partial<FragmentBuildInfo> {
  html: string;
  /** Set when the fragment failed or timed out — slot rendered empty, client-side fallback */
  error?: string;
  _meta?: { cached: boolean };
}

export interface AppRoute {
  path: string;
  component: Component | LazyComponent;
  layout?: string;
  middleware?: string[];
  cache?: string;
}

export type Middleware = (request: Request) => Response | void | Promise<Response | void>;

export interface MatchedRoute {
  path: string;
  component: Component | LazyComponent;
  props: Record<string, string>;
  layout: string;
  middleware: string[];
  cache?: string;
}

export interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  component: Component | LazyComponent;
  layout: string;
  middleware: string[];
  cache?: string;
}

export type FragmentFetcher = (
  fragmentId: string,
  request: Request,
  routeProps: Record<string, string>,
) => Promise<FragmentResponse>;

export type AssetManifest = Record<string, string>;
