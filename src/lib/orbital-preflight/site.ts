import config from '#orbital-preflight-config';
import { resolveConfig } from './config.ts';

/** The resolved config for this build. */
export const site = resolveConfig(config);

/** The deploy base ('' or '/<repo>'), which keys the analytics consent. Set from BASE_PATH. */
export const base: string = __OP_BASE__;
