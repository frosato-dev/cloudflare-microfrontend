import type { Component } from 'vue';

export type LazyComponent = () => Promise<{ default: Component }>;

export interface FragmentResponse {
  html: string;
  css?: string;
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
