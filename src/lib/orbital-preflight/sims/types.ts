import type { Bind, BindingMap, InputId, Mode, ParsedBinds, SimId } from '../types.ts';

/** "Where's my file?" in the Load drawer. UNVERIFIED: flagged for Phil to confirm. */
export interface FileHelp {
	/** A step to take in game first, if any. */
	step?: string;
	path: string;
	tip: string;
}

/**
 * A sim's own words where the mock flight and the HUD speak Elite's: "Flight assist off"
 * is "Decoupled" in Star Citizen. Every key is text the app would show otherwise.
 */
export interface SimWords {
	/** Tab names where the sim's differ from Ship, SRV and On foot. */
	modes?: Partial<Record<Mode, string>>;
	/** The note under the mode tabs, per mode. */
	modeNotes?: Partial<Record<Mode, string>>;
	/** Toast messages, status chips, HUD labels and power pips, by the text they replace. */
	text?: Record<string, string>;
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
	/**
	 * Why the sim's files can't hold the whole of `bind` in a slot whose action holds
	 * `other` in its other slot, or null when they can (modifiers it doesn't take, or one
	 * bind per device).
	 */
	refuse?(bind: Bind, other: Bind | null): string | null;
	/** The device id the sim's files use for a controller they don't name, from its USB ids. */
	newDeviceId?(vendor: string, product: string): string | null;
	/** The download's file name for a preset name. */
	fileName?(parsed: ParsedBinds, presetName: string): string;
	words?: SimWords;
	/**
	 * The game's own default binds, as a file `parse` reads, for "Fly with the defaults"
	 * when the pilot has no file handy. Only for a sim whose defaults we have from the game.
	 */
	defaults?: { label: string; source: string };
}

export class BindsFormatError extends Error {}
