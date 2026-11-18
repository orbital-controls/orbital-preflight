import type { SimId } from '../types.ts';
import { elite } from './elite/index.ts';
import type { SimAdapter } from './types.ts';

/**
 * Star Citizen and X4 are listed so the picker shows them, but neither format has been
 * checked against real files, so neither parses yet. DCS comes later.
 */
const starCitizen: SimAdapter = {
	id: 'star-citizen',
	name: 'Star Citizen',
	short: 'SC',
	status: 'soon',
	extensions: ['.xml'],
	fileLocations: [
		{
			os: 'Windows',
			path: 'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\user\\client\\0\\controls\\mappings\\'
		}
	]
};

const x4: SimAdapter = {
	id: 'x4',
	name: 'X4: Foundations',
	short: 'X4',
	status: 'soon',
	extensions: ['.xml'],
	fileLocations: [{ os: 'Windows', path: 'Documents\\Egosoft\\X4\\<id>\\inputmap.xml' }]
};

const dcs: SimAdapter = {
	id: 'dcs',
	name: 'DCS World',
	short: 'DCS',
	status: 'later',
	extensions: ['.lua'],
	fileLocations: []
};

export const SIMS: readonly SimAdapter[] = [elite, starCitizen, x4, dcs];

export function simById(id: SimId): SimAdapter {
	const sim = SIMS.find((s) => s.id === id);
	if (!sim) throw new Error(`Unknown sim "${id}"`);
	return sim;
}

export type { SimAdapter } from './types.ts';
export { BindsFormatError } from './types.ts';
