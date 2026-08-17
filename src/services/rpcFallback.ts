export function isMissingRpcFunction(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';

  return code === 'PGRST202'
    || message.includes('Could not find the function')
    || (message.includes('function') && message.includes('schema cache'));
}
