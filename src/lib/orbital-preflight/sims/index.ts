import type { SimId } from '../types.ts';
import { elite } from './elite/index.ts';
import type { SimAdapter } from './types.ts';

/**
 * The sim registry. Only a sim whose parser and writer have been checked against real
 * files is `ready`. Star Citizen and X4 have neither yet, so they show as "Coming later"
 * in the bay and the manifest, as DCS does on the boards. Their "Where's my file?" copy
 * is the boards' (UNVERIFIED), kept for when they land.
 */
const starCitizen: SimAdapter = {
	id: 'star-citizen',
	name: 'Star Citizen',
	short: 'SC',
	status: 'later',
	extensions: ['.xml'],
	fileLabel: 'Exported layout .xml',
	modes: [],
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

/**
 * Test builds only: `ORBITAL_PREFLIGHT_MOCK_SIMS=star-citizen` at build time turns a
 * `later` sim into a stand-in that reads and writes Elite Dangerous files under its own
 * name, as the boards' mocks do, so the end-to-end tests can switch between two loaded
 * games while only Elite is ready. Never set for a real build.
 */
function mock(sim: SimAdapter): SimAdapter {
	return {
		...elite,
		id: sim.id,
		name: sim.name,
		short: sim.short,
		help: sim.help,
		parse: (source) => ({ ...elite.parse!(source), sim: sim.id })
	};
}

const MOCKED = new Set<string>(__OP_MOCK_SIMS__);

export const SIMS: readonly SimAdapter[] = [elite, starCitizen, x4, dcs].map((s) =>
	MOCKED.has(s.id) && s.status === 'later' ? mock(s) : s
);

export function simById(id: SimId): SimAdapter {
	const sim = SIMS.find((s) => s.id === id);
	if (!sim) throw new Error(`Unknown sim "${id}"`);
	return sim;
}

export type { SimAdapter } from './types.ts';
export { BindsFormatError } from './types.ts';
