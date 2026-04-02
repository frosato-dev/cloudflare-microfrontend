import type { Component } from 'vue';

export interface FragmentResponse {
  html: string;
  css?: string;
}

export interface RouteDefinition {
  path: string;
  component: string;
  layout: string;
  fragments: string[];
  middleware: string[];
}

export interface LayoutSlots {
  header?: string;
  default: string;
  footer?: string;
}

export type Middleware = (request: Request) => Response | void | Promise<Response | void>;

export interface MatchedRoute {
  path: string;
  component: Component;
  props: Record<string, string>;
  layout: string;
  fragments: string[];
  middleware: string[];
}

export interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  component: Component;
  layout: string;
  fragments: string[];
  middleware: string[];
}

export interface LayoutContext {
  pageHtml: string;
  fragments: Record<string, FragmentResponse>;
  route: MatchedRoute;
  headLinks: string;
  clientScripts: string;
}

export interface StreamLayoutContext {
  fragmentPromises: Record<string, Promise<FragmentResponse>>;
  pageHtmlPromise: Promise<string>;
  route: MatchedRoute;
  headLinks: string;
  clientScripts: string;
}

export type FragmentFetcher = (
  fragmentId: string,
  request: Request,
  routeProps: Record<string, string>,
) => Promise<FragmentResponse>;

export type AssetManifest = Record<string, string>;
