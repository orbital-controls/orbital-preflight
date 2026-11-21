import type { BindingMap, InputId, Mode, ParsedBinds, SimId } from '../types.ts';

/** "Where's my file?" in the Load drawer. UNVERIFIED: flagged for Phil to confirm. */
export interface FileHelp {
	/** A step to take in game first, if any. */
	step?: string;
	path: string;
	tip: string;
}

/**
 * What a sim has to provide. `ready` sims parse and write, and their parser and writer
 * have been checked against real files; `later` ones are listed in the bay and the game
 * manifest as "Coming later" and can't be picked.
 */
export interface SimAdapter {
	id: SimId;
	name: string;
	/** The letter tile and short name, e.g. "ED". */
	short: string;
	status: 'ready' | 'later';
	/** File extensions the drop zone accepts, with the dot. */
	extensions: string[];
	/** The file it needs, e.g. ".binds file" ("Needs your .binds file"). */
	fileLabel: string;
	help: FileHelp;
	/**
	 * The modes its parser files actions under, in tab order, for the bay and the manifest
	 * before a file is in. Once one is, the tabs come from the file's own actions. Empty
	 * for a sim with no parser yet.
	 */
	modes: Mode[];
	parse?(source: string): ParsedBinds;
	/**
	 * A new file: `parsed.source` with the changed slots and the preset name replaced and
	 * every other byte left as it was.
	 */
	write?(parsed: ParsedBinds, bindings: BindingMap, presetName: string): string;
	/**
	 * Why the sim's files can't hold `input`, or null when they can. A rebind refuses an
	 * input the export couldn't write.
	 */
	cannotBind?(input: InputId): string | null;
	/** The device id the sim's files use for a controller they don't name, from its USB ids. */
	newDeviceId?(vendor: string, product: string): string | null;
	/** The download's file name for a preset name. */
	fileName?(parsed: ParsedBinds, presetName: string): string;
}

export class BindsFormatError extends Error {}
