import type { BindingMap, ParsedBinds, SimId } from '../types.ts';

/** "Where's my file?" in the Load drawer. UNVERIFIED: flagged for Phil to confirm. */
export interface FileHelp {
	/** A step to take in game first, if any. */
	step?: string;
	path: string;
	tip: string;
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
	/** What the picker says under the name, e.g. ".binds file". */
	fileLabel: string;
	help: FileHelp;
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
