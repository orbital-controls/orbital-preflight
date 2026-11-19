import type { SimId } from '../types.ts';
import { elite } from './elite/index.ts';
import type { SimAdapter } from './types.ts';

/**
 * Star Citizen and X4 are listed so the picker shows them, but neither format has been
 * checked against real files, so neither parses yet. DCS comes later. Copy is the
 * StandFly board's.
 */
const starCitizen: SimAdapter = {
	id: 'star-citizen',
	name: 'Star Citizen',
	short: 'SC',
	status: 'soon',
	extensions: ['.xml'],
	fileLabel: 'Coming soon',
	help: {
		step: 'Export first, in game: Options → Keybindings → Advanced controls customization → Control profiles → Save.',
		path: '…\\StarCitizen\\LIVE\\USER\\Client\\0\\Controls\\Mappings\\',
		tip: 'Pick the layout_…_exported.xml file you just saved.'
	}
};

const x4: SimAdapter = {
	id: 'x4',
	name: 'X4: Foundations',
	short: 'X4',
	status: 'soon',
	extensions: ['.xml'],
	fileLabel: 'Coming soon',
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
	fileLabel: 'Coming later',
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
