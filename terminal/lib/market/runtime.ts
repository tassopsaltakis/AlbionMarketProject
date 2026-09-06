export interface Runtime {
  static: boolean;
  base: string;
  playerProxy?: string;
}
declare global {
  var __ALBION_RUNTIME__: Runtime | undefined;
}
export function runtime(): Runtime {
  return globalThis.__ALBION_RUNTIME__ || { static: false, base: '/' };
}
