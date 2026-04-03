import type { Component } from 'vue';

export interface FragmentResponse {
  html: string;
  css?: string;
}

export interface AppRoute {
  path: string;
  component: Component;
  layout?: string;
  middleware?: string[];
}

export interface RouteDefinition {
  path: string;
  component: string;
  layout: string;
  middleware: string[];
}

export type Middleware = (request: Request) => Response | void | Promise<Response | void>;

export interface MatchedRoute {
  path: string;
  component: Component;
  props: Record<string, string>;
  layout: string;
  middleware: string[];
}

export interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  component: Component;
  layout: string;
  middleware: string[];
}

export type FragmentFetcher = (
  fragmentId: string,
  request: Request,
  routeProps: Record<string, string>,
) => Promise<FragmentResponse>;

export type AssetManifest = Record<string, string>;
