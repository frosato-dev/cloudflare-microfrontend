export function isDebugRequest(request: Request): boolean {
  const cookie = request.headers.get('cookie');
  return cookie !== null && cookie.indexOf('__debug=1') !== -1;
}

export function isNoCacheRequest(request: Request): boolean {
  const cookie = request.headers.get('cookie');
  return cookie !== null && cookie.indexOf('__debug_nocache=1') !== -1;
}
