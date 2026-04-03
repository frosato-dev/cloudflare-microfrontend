import { defineFragmentConfig } from 'framework/config'

export default defineFragmentConfig({
  cache: 'private, no-cache',
  props(request: Request) {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    return id ? { id } : {}
  },
})
