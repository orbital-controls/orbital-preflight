import type { SimId } from '../types.ts';
import { elite } from './elite/index.ts';
import { starCitizen } from './star-citizen/index.ts';
import type { SimAdapter } from './types.ts';

/**
 * The sim registry. Only a sim whose parser and writer have been checked against real
 * files is `ready`. X4 has neither yet, so it shows as "Coming later" in the bay and the
 * manifest, as DCS does on the boards. Its "Where's my file?" copy is the boards'
 * (UNVERIFIED), kept for when it lands.
 */
const x4: SimAdapter = {
	id: 'x4',
	name: 'X4: Foundations',
	short: 'X4',
	status: 'later',
	extensions: ['.xml'],
	fileLabel: 'inputmap.xml',
	modes: [],
	help: {
		path: 'Documents\\Egosoft\\X4\\[your id number]\\inputmap.xml',
		tip: 'The number folder is your player id. There is usually only one.'
	}
};

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

export function simById(id: SimId): SimAdapter {
	const sim = SIMS.find((s) => s.id === id);
	if (!sim) throw new Error(`Unknown sim "${id}"`);
	return sim;
}

export type { SimAdapter } from './types.ts';
export { BindsFormatError } from './types.ts';
