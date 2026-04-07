export interface ApplicationConfig {
  document: { title: string; baseStyles?: string; viewTransitions?: boolean }
}

export interface FragmentConfigOptions {
  cache?: string
  props?: (request: Request) => Record<string, string>
}

export function defineApplicationConfig(config: ApplicationConfig): ApplicationConfig {
  return config
}

export function defineFragmentConfig(config: FragmentConfigOptions): FragmentConfigOptions {
  return config
}
