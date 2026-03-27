export interface FragmentConfig {
  src: string;
  workerUrl: string;
  cache: 'static' | 'personalized';
  ssrEntry: string;
  clientEntry: string;
}

export interface FrameworkConfig {
  fragments: Record<string, FragmentConfig>;
  shell: { src: string };
}

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
