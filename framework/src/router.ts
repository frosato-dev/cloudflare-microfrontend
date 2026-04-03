import type { RouteRecordRaw } from 'vue-router';
import type { AppRoute, MatchedRoute, RouteEntry } from './types.js';

export function pathToPattern(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const patternStr = path.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${patternStr}$`), paramNames };
}

export function toRouteEntries(routes: AppRoute[]): RouteEntry[] {
  return routes.map((route) => {
    const { pattern, paramNames } = pathToPattern(route.path);
    return {
      pattern,
      paramNames,
      component: route.component,
      layout: route.layout ?? 'default',
      middleware: route.middleware ?? [],
    };
  });
}

export function toClientRoutes(routes: AppRoute[]): RouteRecordRaw[] {
  return routes.map((route) => {
    const hasParams = route.path.includes(':');
    return {
      path: route.path,
      component: route.component,
      ...(hasParams && { props: true }),
      meta: { layout: route.layout ?? 'default' },
    };
  });
}

export function matchRoute(routes: RouteEntry[], pathname: string): MatchedRoute | null {
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (match) {
      const props: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        props[name] = match[i + 1];
      });
      return {
        path: pathname,
        component: route.component,
        props,
        layout: route.layout,
        middleware: route.middleware,
      };
    }
  }
  return null;
}
