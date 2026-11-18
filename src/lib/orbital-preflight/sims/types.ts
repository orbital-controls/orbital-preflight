import type { BindingMap, ParsedBinds, SimId } from '../types.ts';

/** Where a sim keeps its binds, as shown under "Where's my file?". */
export interface FileLocation {
	os: string;
	path: string;
}

/**
 * What a sim has to provide. `ready` sims parse and write; `soon` and `later` ones are
 * listed in the sim picker but can't be loaded yet.
 */
export interface SimAdapter {
	id: SimId;
	name: string;
	/** Short name for tags, e.g. "ED". */
	short: string;
	status: 'ready' | 'soon' | 'later';
	/** File extensions the drop zone accepts, with the dot. */
	extensions: string[];
	/** Not verified against the sims themselves: see the README. */
	fileLocations: FileLocation[];
	parse?(source: string): ParsedBinds;
	/**
	 * A new file: `parsed.source` with the changed slots and the preset name replaced and
	 * every other byte left as it was.
	 */
	write?(parsed: ParsedBinds, bindings: BindingMap, presetName: string): string;
	/** The download's file name for a preset name. */
	fileName?(parsed: ParsedBinds, presetName: string): string;
}

export class BindsFormatError extends Error {}
