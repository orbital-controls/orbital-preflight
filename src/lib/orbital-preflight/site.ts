import config from '#orbital-preflight-config';
import { resolveConfig } from './config.ts';

/** The resolved config for this build. */
export const site = resolveConfig(config);
