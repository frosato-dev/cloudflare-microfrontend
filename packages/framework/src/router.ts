import type { MatchedRoute, RouteEntry } from './types.js';

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
        fragments: route.fragments,
        middleware: route.middleware,
      };
    }
  }
  return null;
}
