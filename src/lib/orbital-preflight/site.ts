import config from '#orbital-preflight-config';
import { resolveConfig } from './config.ts';

/** The resolved config for this build. */
export const site = resolveConfig(config);

/** The deploy base ('' or '/<repo>'), for storage keys. Set at build time from BASE_PATH. */
export const base: string = __OP_BASE__;
