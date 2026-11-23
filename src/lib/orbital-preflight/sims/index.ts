import type { SimId } from '../types.ts';
import { elite } from './elite/index.ts';
import { starCitizen } from './star-citizen/index.ts';
import type { SimAdapter } from './types.ts';
import { x4 } from './x4/index.ts';

/**
 * The sim registry. Only a sim whose parser and writer have been checked against real
 * files is `ready`; DCS isn't yet, so it shows as "Coming later" in the bay and the
 * manifest, as it does on the boards.
 */
const dcs: SimAdapter = {
	id: 'dcs',
	name: 'DCS World',
	short: 'DCS',
	status: 'later',
	extensions: ['.lua'],
	fileLabel: 'One file per aircraft',
	modes: [],
	help: {
		path: 'Saved Games\\DCS\\Config\\Input\\[aircraft]\\',
		tip: 'DCS keeps one file per aircraft per device. Support comes after the first three.'
	}
};

export const SIMS: readonly SimAdapter[] = [elite, starCitizen, x4, dcs];

/** Ready sims that open on their game's own defaults: they always have binds to fly. */
export const SIMS_WITH_DEFAULTS: readonly SimId[] = SIMS.filter(
	(s) => s.status === 'ready' && s.defaults
).map((s) => s.id);

export function simById(id: SimId): SimAdapter {
	const sim = SIMS.find((s) => s.id === id);
	if (!sim) throw new Error(`Unknown sim "${id}"`);
	return sim;
}

export type { SimAdapter } from './types.ts';
export { BindsFormatError } from './types.ts';
