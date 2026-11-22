import {
	clashingActions,
	filterCounts,
	isChanged,
	resolve,
	type FilterCounts,
	type Resolution,
	type SlotRef
} from './bindings.ts';
import { simById } from './sims/index.ts';
import type { Action, Bind, Binding, BindingMap, Mode, ParsedBinds } from './types.ts';
import { MODES } from './types.ts';

/** Where the loaded file came from, for the "Binding for" block. */
export type FileOrigin =
	| { kind: 'preset'; index: number; label: string }
	| { kind: 'upload'; fileName: string }
	| { kind: 'remembered'; label: string }
	| { kind: 'defaults'; label: string };

export interface LoadedFile {
	parsed: ParsedBinds;
	origin: FileOrigin;
}

/**
 * The binds being tested: the file as loaded, the edited copy, and an undo stack per
 * action. One instance is shared by the fly page and the full editor.
 */
export class BindStore {
	file = $state.raw<LoadedFile | null>(null);
	/** Called after every edit (settle, undo, reset…), e.g. to save a remembered layout. */
	onchange: (() => void) | null = null;
	bindings = $state.raw<BindingMap>({});
	#history = $state.raw<Record<string, Binding[]>>({});

	original = $derived(this.file?.parsed.bindings ?? {});
	actions = $derived<Action[]>(this.file?.parsed.actions ?? []);

	clashes = $derived(
		Object.fromEntries(
			MODES.map((m) => [m, clashingActions(this.actions, this.bindings, m)])
		) as Record<Mode, Set<string>>
	);

	counts = $derived(
		Object.fromEntries(
			MODES.map((m) => [m, filterCounts(this.actions, this.bindings, this.original, m)])
		) as Record<Mode, FilterCounts>
	);

	/** Changed actions across every mode: the unsaved count in the top bar. */
	changes = $derived(MODES.reduce((sum, m) => sum + this.counts[m].changed, 0));

	load(parsed: ParsedBinds, origin: FileOrigin, edited?: BindingMap) {
		this.file = { parsed, origin };
		this.bindings = edited
			? { ...parsed.bindings, ...pick(edited, parsed.bindings) }
			: parsed.bindings;
		this.#history = {};
	}

	actionsIn(mode: Mode): Action[] {
		return this.actions.filter((a) => a.mode === mode);
	}

	isChanged(actionId: string): boolean {
		return isChanged(this.bindings, this.original, actionId);
	}

	/** Settles a rebind. Every action it touches can be undone on its own. */
	settle(target: SlotRef, resolution: Resolution, candidate: Bind | null) {
		const next = resolve(this.bindings, this.original, this.actions, target, resolution, candidate);
		this.#commit(next);
	}

	#commit(next: BindingMap) {
		const history = { ...this.#history };
		for (const id of Object.keys(next)) {
			if (next[id] !== this.bindings[id]) history[id] = [...(history[id] ?? []), this.bindings[id]];
		}
		this.#history = history;
		this.bindings = next;
		this.onchange?.();
	}

	/** One step back for this action; with no history left, back to the file. */
	undo(actionId: string) {
		const stack = this.#history[actionId] ?? [];
		const previous = stack.at(-1) ?? this.original[actionId];
		if (!previous) return;
		this.#history = { ...this.#history, [actionId]: stack.slice(0, -1) };
		this.bindings = { ...this.bindings, [actionId]: previous };
		this.onchange?.();
	}

	/** Replaces one action's binds outright (the editor's swap and clear). */
	set(actionId: string, binding: Binding) {
		this.#commit({ ...this.bindings, [actionId]: binding });
	}

	/** One action back to the file. */
	revert(actionId: string) {
		const original = this.original[actionId];
		if (original) this.set(actionId, original);
	}

	/** Every action in `mode` back to the file. */
	resetMode(mode: Mode) {
		const next = { ...this.bindings };
		for (const action of this.actionsIn(mode)) next[action.id] = this.original[action.id];
		this.#commit(next);
	}

	/** Changed actions in `mode`, for the per-mode badges. */
	changedIn(mode: Mode): number {
		return this.counts[mode].changed;
	}

	/** The new file. The original source string is never modified. */
	exportFile(presetName: string): { fileName: string; text: string } | null {
		const file = this.file;
		if (!file) return null;
		const sim = simById(file.parsed.sim);
		if (!sim.write) return null;
		const text = sim.write(file.parsed, this.bindings, presetName);
		return { fileName: exportFileName(file.parsed, presetName), text };
	}

	/** Only the edited actions, for "Remember this layout". */
	edits(): BindingMap {
		const out: BindingMap = {};
		for (const id of Object.keys(this.bindings))
			if (this.isChanged(id)) out[id] = this.bindings[id];
		return out;
	}
}

function pick(edited: BindingMap, known: BindingMap): BindingMap {
	return Object.fromEntries(Object.entries(edited).filter(([id]) => id in known));
}

export function exportFileName(parsed: ParsedBinds, presetName: string): string {
	const sim = simById(parsed.sim);
	if (sim.fileName) return sim.fileName(parsed, presetName);
	const safe = presetName.replace(/[^\w .-]/g, '').trim() || 'Custom';
	return `${safe}${sim.extensions[0] ?? ''}`;
}

/** Hands a string to the browser as a download. */
export function download(fileName: string, text: string, type = 'application/xml') {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
