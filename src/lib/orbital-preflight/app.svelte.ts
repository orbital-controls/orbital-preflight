import { getContext, setContext } from 'svelte';
import { BindStore, download, type FileOrigin } from './binds.svelte.ts';
import {
	findHolders,
	sameInput,
	type Resolution,
	type ShowFilter,
	type SlotRef
} from './bindings.ts';
import type { ResolvedConfig } from './config.ts';
import { act, enterMode, initialFlight, setThrottle, tick, type FlightState } from './flight.ts';
import { InputHub, type InputEvent } from './inputs/hub.svelte.ts';
import { deviceRoles } from './labels.ts';
import { withLocalActions } from './local-actions.ts';
import { analogAxes, type Analog } from './scene/analog.ts';
import { clearLayout, loadLayout, saveLayout } from './persist.ts';
import { BindsFormatError, simById } from './sims/index.ts';
import type { Action, Bind, InputId, Mode, SimId } from './types.ts';

export interface Capture {
	target: SlotRef;
	/** The input pressed since listening started; pressing again replaces it. */
	cand: Bind | null;
}

/** The editor's clash card: the input was pressed, but another action holds it. */
export interface Pending {
	target: SlotRef;
	cand: Bind;
	holder: SlotRef;
}

export interface EditorView {
	sel: string | null;
	cat: string;
	filter: ShowFilter;
	q: string;
	pend: Pending | null;
}

/**
 * Everything the page shows that isn't the binds themselves: mode, filters, the rebind
 * card, drawers, the full editor, the mock flight and the last input. One instance per
 * page, shared through context.
 */
export class OrbitalPreflight {
	readonly store = new BindStore();
	readonly hub = new InputHub();

	mode = $state<Mode>('ship');
	cat = $state('All');
	filter = $state<ShowFilter>('all');
	q = $state('');
	cap = $state.raw<Capture | null>(null);
	drawer = $state<'load' | 'devices' | null>(null);
	leaving = $state(false);
	editor = $state(false);
	ed = $state<EditorView>({ sel: null, cat: 'All', filter: 'all', q: '', pend: null });
	flight = $state.raw<FlightState>(initialFlight());
	last = $state.raw<InputId | null>(null);
	lastActs = $state.raw<string[]>([]);
	remember = $state(false);
	sim = $state<SimId>('elite-dangerous');
	loadError = $state<string | null>(null);
	/**
	 * WebGL couldn't start, or the 3D scene failed mid-flight: the viewport keeps the 2D
	 * placeholder for the rest of the visit, even when it remounts.
	 */
	sceneFailed = $state(false);

	/**
	 * Every device binds can name: the file's, then controllers plugged in that the file
	 * doesn't have yet (they join the export once something is bound to them).
	 */
	roles = $derived(
		deviceRoles([
			...(this.store.file?.parsed.devices ?? []),
			...this.hub.pads
				.filter((p) => p.pairedBy === 'new' && p.deviceId)
				.filter((p) => !this.store.file?.parsed.devices.some((d) => d.id === p.deviceId))
				.map((p) => ({ id: p.deviceId!, name: p.name }))
		])
	);
	/** Why the last input pressed while listening can't be used, if it can't. */
	capNotice = $state<string | null>(null);
	loaded = $derived(this.store.file !== null);

	constructor(
		readonly config: ResolvedConfig,
		readonly base: string,
		/** Shipped preset files by name, read at build time. */
		readonly presetSources: Record<string, string>
	) {
		this.sim = config.sim;
		this.hub.newDeviceId = simById(config.sim).newDeviceId ?? null;
		// A remembered layout follows every edit.
		this.store.onchange = () => this.persist();
	}

	openDrawer(kind: 'load' | 'devices') {
		this.cancelCapture();
		this.drawer = kind;
		if (kind === 'devices') this.armPairing();
	}

	closeDrawer() {
		this.drawer = null;
		this.hub.pairNext(null);
	}

	/** The first device in the file with no controller paired to it. */
	unpairedDevice(): string | null {
		const devices = this.store.file?.parsed.devices ?? [];
		return devices.find((d) => !this.hub.pads.some((p) => p.deviceId === d.id))?.id ?? null;
	}

	/**
	 * While the Controllers drawer is open, the next button pressed on a controller that
	 * isn't paired yet pairs it with the first device in the file that has none.
	 */
	armPairing() {
		if (this.drawer !== 'devices' || !this.unpairedDevice()) {
			this.hub.pairNext(null);
			return;
		}
		this.hub.pairNext((pad) => {
			const target = this.unpairedDevice();
			if (target) this.hub.pair(pad.index, target, 'press');
			this.armPairing();
		});
	}

	/** "Re-pair": let go of this controller and wait for a press. */
	unpair(index: number) {
		this.hub.pair(index, null);
		this.armPairing();
	}

	/** Restores a remembered layout, or opens the pilot's default preset. */
	init() {
		const remembered = loadLayout(this.base);
		if (remembered) {
			try {
				const parsed = simById(remembered.sim).parse?.(remembered.source);
				if (parsed) {
					this.#afterLoad(
						parsed,
						{ kind: 'remembered', label: remembered.label },
						remembered.edits
					);
					this.remember = true;
					return;
				}
			} catch {
				clearLayout(this.base);
			}
		}
		if (this.config.presets.length) this.loadPreset(0);
	}

	loadPreset(index: number) {
		const preset = this.config.presets[index];
		const text = preset && this.presetSources[preset.file];
		if (!text) {
			this.loadError = `The preset file ${preset?.file ?? ''} is missing from static/binds/.`;
			return;
		}
		this.loadText(text, { kind: 'preset', index, label: preset.label }, this.config.sim);
	}

	loadText(text: string, origin: FileOrigin, simId: SimId = this.sim): boolean {
		const sim = simById(simId);
		if (!sim.parse) {
			this.loadError = `${sim.name} files can't be read yet.`;
			return false;
		}
		try {
			this.#afterLoad(sim.parse(text), origin);
			return true;
		} catch (error) {
			this.loadError =
				error instanceof BindsFormatError ? error.message : "That file couldn't be read.";
			return false;
		}
	}

	/** Reads a dropped or chosen file in the tab. Nothing is uploaded. */
	loadFile(file: File): Promise<boolean> {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () =>
				resolve(
					this.loadText(String(reader.result ?? ''), { kind: 'upload', fileName: file.name })
				);
			reader.onerror = () => {
				this.loadError = "That file couldn't be read.";
				resolve(false);
			};
			reader.readAsText(file);
		});
	}

	#afterLoad(
		parsed: Parameters<BindStore['load']>[0],
		origin: FileOrigin,
		edits?: Parameters<BindStore['load']>[2]
	) {
		this.cancelCapture();
		this.store.load(withLocalActions(parsed), origin, edits);
		this.sim = parsed.sim;
		this.hub.devices = parsed.devices;
		this.hub.newDeviceId = simById(parsed.sim).newDeviceId ?? null;
		this.hub.repair();
		this.loadError = null;
		this.closeDrawer();
		this.cat = 'All';
		this.filter = 'all';
		this.q = '';
		this.last = null;
		this.lastActs = [];
		// The camera is the pilot's choice, not the file's: it stays across loads.
		this.flight = { ...initialFlight(), cam: this.flight.cam };
		this.ed = { sel: null, cat: 'All', filter: 'all', q: '', pend: null };
		this.persist();
	}

	/** What the "Binding for" block's file line says. */
	fileLine = $derived.by(() => {
		const origin = this.store.file?.origin;
		if (!origin) return '';
		if (origin.kind === 'preset') return `Pilot's binds · ${origin.label}`;
		if (origin.kind === 'upload') return origin.fileName;
		return origin.label;
	});

	setMode(mode: Mode) {
		this.cancelCapture();
		this.mode = mode;
		this.cat = 'All';
		this.q = '';
		this.last = null;
		this.lastActs = [];
		this.flight = enterMode(this.flight);
		this.ed = { ...this.ed, sel: null, cat: 'All', pend: null };
	}

	/**
	 * What to call a device from the file: the name of the controller paired with it, or
	 * the file's own name for it until one is.
	 */
	deviceName(fileDeviceId: string): string {
		const pad = this.hub.pads.find((p) => p.deviceId === fileDeviceId);
		if (pad) return pad.name;
		return this.store.file?.parsed.devices.find((d) => d.id === fileDeviceId)?.name ?? fileDeviceId;
	}

	actionById(id: string): Action | undefined {
		return this.store.actions.find((a) => a.id === id);
	}

	// Rebinding on the fly page.

	startCapture(target: SlotRef) {
		this.cap = { target, cand: null };
		this.capNotice = null;
		this.ed = { ...this.ed, pend: null };
		this.hub.capture(
			(bind) => this.#onCandidate(bind),
			() => this.cancelCapture()
		);
	}

	/** Why a pressed input can't be bound, or null. */
	#cannotBind(bind: Bind): string | null {
		const sim = simById(this.sim);
		for (const input of [bind.input, ...(bind.modifiers ?? [])]) {
			if ('deviceId' in input && input.deviceId.startsWith('browser-')) {
				return "Your browser doesn't report this controller's USB id, so a bind on it couldn't be saved.";
			}
			const reason = sim.cannotBind?.(input);
			if (reason) return reason;
		}
		return null;
	}

	#onCandidate(bind: Bind) {
		const cap = this.cap;
		if (!cap) return;
		const reason = this.#cannotBind(bind);
		if (reason) {
			this.capNotice = `${reason} Try another.`;
			return;
		}
		this.capNotice = null;
		const action = this.actionById(cap.target.actionId);
		// An axis action takes the whole axis; a button action keeps the half it was pushed to.
		const cand =
			action?.axis && bind.input.kind === 'axis'
				? { input: { ...bind.input, half: undefined } }
				: bind;
		if (this.editor) {
			const holder = this.holderOf(cap.target, cand);
			this.cap = null;
			this.hub.stopCapture();
			if (holder) this.ed = { ...this.ed, pend: { target: cap.target, cand, holder } };
			else this.store.settle(cap.target, { kind: 'apply' }, cand);
			return;
		}
		this.cap = { ...cap, cand };
	}

	retryCapture() {
		if (this.cap) this.cap = { ...this.cap, cand: null };
		this.capNotice = null;
	}

	cancelCapture() {
		this.cap = null;
		this.capNotice = null;
		this.hub.stopCapture();
	}

	/** Another slot in this mode that already holds `cand`. */
	holderOf(target: SlotRef, cand: Bind | null): SlotRef | null {
		if (!cand) return null;
		const action = this.actionById(target.actionId);
		if (!action) return null;
		return (
			findHolders(this.store.actions, this.store.bindings, action.mode, cand, target)[0] ?? null
		);
	}

	/** Apply, Move it here, Swap, Keep both, Clear this slot, Back to file. */
	settle(kind: Resolution['kind']) {
		const cap = this.cap;
		if (!cap) return;
		this.store.settle(cap.target, { kind } as Resolution, cap.cand);
		this.cancelCapture();
		this.last = null;
		this.lastActs = [];
	}

	settlePending(kind: 'move' | 'swap' | 'keep-both') {
		const pend = this.ed.pend;
		if (!pend) return;
		this.store.settle(pend.target, { kind }, pend.cand);
		this.ed = { ...this.ed, pend: null };
	}

	// Input dispatch.

	/** Actions in the current mode that `input` fires, with the effect each one runs. */
	matching(input: InputId): { action: Action; effect: string | undefined }[] {
		const held: { action: Action; effect: string | undefined; modifier: boolean }[] = [];
		for (const action of this.store.actionsIn(this.mode)) {
			const binding = this.store.bindings[action.id];
			if (!binding) continue;
			for (const slot of binding) {
				if (!slot) continue;
				let effect: string | undefined;
				if (sameInput(slot.input, input)) {
					effect =
						action.effect?.includes('|') || action.effect === 'throttle'
							? undefined
							: action.effect;
				} else if (
					input.kind === 'axis' &&
					input.half &&
					slot.input.kind === 'axis' &&
					!slot.input.half &&
					slot.input.deviceId === input.deviceId &&
					slot.input.axis === input.axis
				) {
					const [neg, pos] = (action.effect ?? '').split('|');
					effect = input.half === 'neg' ? neg : pos;
				} else continue;
				if (!this.hub.modifiersHeld(slot.modifiers)) continue;
				held.push({
					action,
					effect: effect || undefined,
					modifier: Boolean(slot.modifiers?.length)
				});
				break;
			}
		}
		// Shift+W and W: with Shift held, only the modified bind fires.
		const modified = held.filter((h) => h.modifier);
		return (modified.length ? modified : held).map(({ action, effect }) => ({ action, effect }));
	}

	onInput({ input, pressed }: InputEvent) {
		if (!pressed || !this.loaded || this.drawer || this.leaving) return;
		if (this.editor) {
			// Not listening: a press jumps to the action it fires.
			const owner = this.matching(input)[0]?.action;
			if (owner) this.ed = { ...this.ed, sel: owner.id, cat: 'All', filter: 'all', q: '' };
			return;
		}
		const hits = this.matching(input);
		let flight = this.flight;
		// As on the board, an action with no effect of its own says it "would open".
		for (const { action, effect } of hits) {
			if (effect) flight = act(flight, effect, action.name);
			else if (!action.axis) flight = act(flight, 'panel', action.name);
		}
		this.flight = flight;
		this.last = input;
		this.lastActs = hits.map((h) => h.action.id);
	}

	/** Follows a bound throttle axis. Called by the hub when an axis moves. */
	followThrottle() {
		if (this.mode !== 'ship') return;
		const action = this.store.actionsIn('ship').find((a) => a.effect === 'throttle');
		const input = action && this.store.bindings[action.id]?.[0]?.input;
		if (input?.kind !== 'axis') return;
		// The hub names a paired controller's axes by the file device it stands for.
		const value = this.hub.axes.get(`${input.deviceId}:${input.axis}`);
		if (value !== undefined) this.flight = setThrottle(this.flight, value);
	}

	/**
	 * Bound axes in this mode as they are now, for the 3D scene to fly or drive by: pitch,
	 * roll and yaw for the ship, steering and drive speed for the SRV. Nothing while
	 * listening for a rebind or with a drawer open: the vehicle freezes, as the mock flight
	 * does.
	 */
	analog = $derived.by((): Analog => {
		const idle = this.cap !== null || this.drawer !== null || this.leaving || this.mode === 'foot';
		return analogAxes(
			this.store.actionsIn(this.mode),
			this.store.bindings,
			idle ? null : this.hub.axes
		);
	});

	/**
	 * The viewport's camera button: the same as pressing a bound Toggle camera, so it's
	 * ignored at the same times (listening for a rebind, a drawer or dialog open).
	 */
	toggleCamera() {
		if (this.cap || this.drawer || this.leaving || !this.loaded) return;
		this.flight = act(this.flight, 'camera', 'Toggle camera');
	}

	step() {
		if (this.loaded && !this.editor) this.flight = tick(this.flight, this.mode);
	}

	// Files out.

	exportName(): string {
		const name = this.store.file?.parsed.presetName || 'Custom';
		return `${name} rebound`;
	}

	exportPreset(): boolean {
		const out = this.store.exportFile(this.exportName());
		if (!out) return false;
		download(out.fileName, out.text);
		return true;
	}

	persist() {
		const file = this.store.file;
		if (!this.remember || !file) return;
		saveLayout(this.base, {
			sim: file.parsed.sim,
			label: this.fileLine.replace(/^Pilot's binds · /, ''),
			source: file.parsed.source,
			edits: this.store.edits()
		});
	}

	setRemember(on: boolean) {
		this.remember = on;
		if (on) this.persist();
		else clearLayout(this.base);
	}

	leaveNow() {
		window.location.href = this.config.homeUrl;
	}
}

const KEY = Symbol('orbital-preflight');

export function setOrbitalPreflight(app: OrbitalPreflight) {
	setContext(KEY, app);
}

export function useOrbitalPreflight(): OrbitalPreflight {
	return getContext<OrbitalPreflight>(KEY);
}
