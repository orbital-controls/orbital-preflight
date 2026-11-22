import { getContext, setContext } from 'svelte';
import { BindStore, download, type FileOrigin } from './binds.svelte.ts';
import {
	axisValueKey,
	findHolders,
	inputKey,
	sameInput,
	wholeAxis,
	type Resolution,
	type ShowFilter,
	type SlotRef
} from './bindings.ts';
import { firstVisit, presetFor, type ResolvedConfig } from './config.ts';
import { act, enterMode, initialFlight, setThrottle, tick, type FlightState } from './flight.ts';
import { InputHub, type BrowserPad, type InputEvent } from './inputs/hub.svelte.ts';
import { deviceRoles } from './labels.ts';
import { withLocalActions } from './local-actions.ts';
import { analogAxes, type Analog } from './scene/analog.ts';
import { heldEffects, NO_HELD } from './scene/held.ts';
import { clearLayout, loadLayouts, saveLayout, type RememberedLayout } from './persist.ts';
import { Session, Sessions } from './sessions.svelte.ts';
import { BindsFormatError, SIMS, simById } from './sims/index.ts';
import type { SimAdapter } from './sims/index.ts';
import {
	MODE_NAMES,
	MODES,
	type Action,
	type Bind,
	type InputId,
	type Mode,
	type ParsedBinds,
	type SimId
} from './types.ts';

/** One game as the bay and the manifest list it. */
export interface GameRow {
	sim: SimAdapter;
	/** Loaded this visit (it has a session). */
	loaded: boolean;
	/** The game being bound now, loaded or waiting for its file. */
	current: boolean;
	changes: number;
	/** Its file, what it needs, or the pilot's preset waiting for it. */
	file: string;
	/** "Ship · SRV · On foot": from the file once loaded, else what the parser reads. */
	modeList: string;
	/** "3 unsaved", "No changes", "Not loaded", "Waiting for file", "Coming later". */
	status: string;
}

/** What the fly page and the editor read before any game is loaded. */
const EMPTY = new BindStore();

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
 * Everything the page shows that isn't the binds themselves: the games loaded this visit
 * and which is current, filters, the rebind card, drawers, the game manifest, the full
 * editor, the mock flight and the last input. One instance per page, shared through
 * context. `store` and `mode` are the current game's.
 */
export class OrbitalPreflight {
	readonly games = new Sessions();
	readonly hub = new InputHub();

	/** The current game's binds: an empty store while no game is loaded. */
	get store(): BindStore {
		return this.games.current?.store ?? EMPTY;
	}

	/** The current game's mode. */
	get mode(): Mode {
		return this.games.current?.mode ?? 'ship';
	}
	set mode(mode: Mode) {
		if (this.games.current) this.games.current.mode = mode;
	}

	/** The current game's modes, from its file. */
	modes = $derived(this.games.current?.modes ?? []);

	/** The game picked in the bay or the manifest; the config's sim before one is. */
	get sim(): SimId {
		return this.games.currentSim ?? this.config.sim;
	}

	/** A game is picked (loaded or waiting for its file): no bay. */
	chosen = $derived(this.games.currentSim !== null);

	/** The game manifest under "Binding for" is open. Bind inputs don't fire meanwhile. */
	manifest = $state(false);
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
	/** "Remember this layout" ticked before the game's file is in. */
	#rememberNext = false;
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
				.map((p) => ({
					id: p.deviceId!,
					name: p.name,
					...(p.standard && { gamepad: true as const })
				}))
		])
	);
	/** Why the last input pressed while listening can't be used, if it can't. */
	capNotice = $state<string | null>(null);
	loaded = $derived(this.games.current !== null);

	/** "Remember this layout on this browser", for the current game. */
	get remember(): boolean {
		return this.games.current?.remember ?? this.#rememberNext;
	}

	/** Anything over the page that stops bind inputs: a drawer, Leave, the manifest. */
	get blocked(): boolean {
		return this.drawer !== null || this.leaving || this.manifest;
	}

	constructor(
		readonly config: ResolvedConfig,
		readonly base: string,
		/** Shipped preset files by name, read at build time. */
		readonly presetSources: Record<string, string>
	) {
		this.hub.newDeviceId = simById(config.sim).newDeviceId ?? null;
	}

	openDrawer(kind: 'load' | 'devices') {
		this.cancelCapture();
		this.manifest = false;
		this.drawer = kind;
		if (kind === 'devices') this.armPairing();
	}

	closeDrawer() {
		this.drawer = null;
		this.hub.pairNext(null);
	}

	/**
	 * The first device in the file with no controller paired to it. For a controller,
	 * one of its own sort first: a gamepad pairs with the file's gamepad, a stick with a stick.
	 */
	unpairedDevice(pad?: BrowserPad): string | null {
		const devices = (this.store.file?.parsed.devices ?? []).filter(
			(d) => !this.hub.pads.some((p) => p.deviceId === d.id)
		);
		const sameSort = pad && devices.find((d) => Boolean(d.gamepad) === pad.standard);
		return (sameSort ?? devices[0])?.id ?? null;
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
			const target = this.unpairedDevice(pad);
			if (target) this.hub.pair(pad.index, target, 'press');
			this.armPairing();
		});
	}

	/** "Re-pair": let go of this controller and wait for a press. */
	unpair(index: number) {
		this.hub.pair(index, null);
		this.armPairing();
	}

	/**
	 * First visit: remembered games come back (the newest is current) and skip the bay;
	 * otherwise presets for one sim open the first of them; otherwise the bay.
	 */
	init() {
		const ready = SIMS.filter((s) => s.status === 'ready').map((s) => s.id);
		const restored = loadLayouts(this.base, ready).filter((l) => this.#restore(l));
		const route = firstVisit(this.config.presets, restored.length);
		if (route.kind === 'restore') this.switchTo(restored[0].sim);
		else if (route.kind === 'preset') this.loadPreset(route.index);
	}

	#restore(layout: RememberedLayout): boolean {
		try {
			const parsed = simById(layout.sim).parse?.(layout.source);
			if (!parsed) return false;
			const session = this.games.open(layout.sim, (s) => this.#wire(s));
			session.store.load(
				withLocalActions(parsed),
				{ kind: 'remembered', label: layout.label },
				layout.edits
			);
			if (layout.mode && session.modes.includes(layout.mode)) session.mode = layout.mode;
			session.remember = true;
			return true;
		} catch {
			clearLayout(this.base, layout.sim);
			return false;
		}
	}

	/** A remembered layout follows every edit to its game. */
	#wire(session: Session) {
		session.store.onchange = () => this.persist(session);
	}

	/** The pilot's presets for the current game, with their index in the config. */
	presets = $derived.by(() =>
		this.config.presets.map((p, index) => ({ ...p, index })).filter((p) => p.sim === this.sim)
	);

	loadPreset(index: number) {
		const preset = this.config.presets[index];
		const text = preset && this.presetSources[preset.file];
		if (!text) {
			this.loadError = `The preset file ${preset?.file ?? ''} is missing from static/binds/.`;
			return;
		}
		if (this.games.currentSim !== preset.sim) this.switchTo(preset.sim);
		this.loadText(text, { kind: 'preset', index, label: preset.label }, preset.sim);
	}

	/** Loads a file for one game (the current one by default). Other games are not touched. */
	loadText(text: string, origin: FileOrigin, simId: SimId = this.sim): boolean {
		const sim = simById(simId);
		if (!sim.parse || sim.status !== 'ready') {
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

	/** Loads the current game's own default binds, for a pilot with no file handy. */
	loadDefaults(): boolean {
		const sim = simById(this.sim);
		if (!sim.defaults) return false;
		return this.loadText(
			sim.defaults.source,
			{ kind: 'defaults', label: sim.defaults.label },
			sim.id
		);
	}

	/** Reads a dropped or chosen file in the tab. Nothing is uploaded. */
	loadFile(file: File): Promise<boolean> {
		const sim = this.sim;
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () =>
				resolve(
					this.loadText(String(reader.result ?? ''), { kind: 'upload', fileName: file.name }, sim)
				);
			reader.onerror = () => {
				this.loadError = "That file couldn't be read.";
				resolve(false);
			};
			reader.readAsText(file);
		});
	}

	#afterLoad(parsed: ParsedBinds, origin: FileOrigin) {
		this.cancelCapture();
		const fresh = !this.games.get(parsed.sim);
		const session = this.games.open(parsed.sim, (s) => this.#wire(s));
		if (fresh) session.remember = this.#rememberNext;
		this.#rememberNext = false;
		session.store.load(withLocalActions(parsed), origin);
		if (!session.modes.includes(session.mode)) session.mode = session.modes[0] ?? 'ship';
		if (this.games.currentSim !== parsed.sim) this.games.currentSim = parsed.sim;
		this.hub.devices = parsed.devices;
		this.hub.newDeviceId = simById(parsed.sim).newDeviceId ?? null;
		this.hub.repair();
		this.loadError = null;
		this.closeDrawer();
		this.manifest = false;
		this.cat = 'All';
		this.filter = 'all';
		this.q = '';
		this.#freshFlight();
		this.ed = { sel: null, cat: 'All', filter: 'all', q: '', pend: null };
		this.persist(session);
	}

	/**
	 * The mock flight starts over (throttle, gear and the rest); the camera is the pilot's
	 * choice, not the file's or the game's, so it stays.
	 */
	#freshFlight() {
		this.last = null;
		this.lastActs = [];
		this.flight = { ...initialFlight(), cam: this.flight.cam };
		this.footStop = null;
		this.footDone = [];
	}

	// Switching games.

	/**
	 * Makes `sim` the current game. A loaded game comes back exactly as it was left: file,
	 * edits, mode and controller pairing. One with no file yet waits for one (the file
	 * drop). Only the mock flight starts over. On the fly page the filters reset, as on
	 * the board; in the editor, category, filter and search stay and the selection clears.
	 */
	switchTo(sim: SimId) {
		this.manifest = false;
		if (simById(sim).status !== 'ready') return;
		if (sim === this.games.currentSim) return;
		this.cancelCapture();
		this.closeDrawer();
		const leaving = this.games.current;
		if (leaving) leaving.pairing = this.hub.pairing();
		this.games.currentSim = sim;
		const session = this.games.current;
		const adapter = simById(sim);
		this.hub.restore(
			session?.store.file?.parsed.devices ?? [],
			adapter.newDeviceId ?? null,
			session?.pairing ?? []
		);
		this.loadError = null;
		this.cat = 'All';
		this.filter = 'all';
		this.q = '';
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local lookup, not state
		const cats = new Set(this.store.actionsIn(this.mode).map((a) => a.category));
		this.ed = {
			...this.ed,
			cat: this.ed.cat === 'All' || cats.has(this.ed.cat) ? this.ed.cat : 'All',
			sel: null,
			pend: null
		};
		this.#freshFlight();
		// The newest remembered game opens first next visit.
		if (session) this.persist(session);
	}

	/** "Pick another game": back to the bay. Loaded games stay loaded. */
	openBay() {
		this.cancelCapture();
		this.closeDrawer();
		this.manifest = false;
		const leaving = this.games.current;
		if (leaving) leaving.pairing = this.hub.pairing();
		this.games.currentSim = null;
		this.hub.restore([], simById(this.config.sim).newDeviceId ?? null, []);
		this.loadError = null;
		this.#freshFlight();
	}

	/** A tile in the bay: a loaded game comes back; otherwise its pilot's preset or the file drop. */
	pickInBay(sim: SimId) {
		if (simById(sim).status !== 'ready') return;
		const preset = presetFor(this.config.presets, sim);
		this.switchTo(sim);
		if (!this.games.get(sim) && preset >= 0) this.loadPreset(preset);
	}

	/** Every sim in registry order, for the bay and the manifest. */
	gameRows = $derived.by((): GameRow[] =>
		SIMS.map((sim) => {
			const session = this.games.get(sim.id);
			const current = this.games.currentSim === sim.id;
			const changes = this.games.changesBySim.get(sim.id) ?? 0;
			const preset = this.config.presets[presetFor(this.config.presets, sim.id)];
			const modes = session ? session.modes : sim.modes;
			const ready = sim.status === 'ready';
			return {
				sim,
				loaded: Boolean(session),
				current,
				changes,
				file: session
					? fileLine(session)
					: !ready
						? sim.fileLabel
						: preset
							? `Pilot's binds · ${preset.label}`
							: `Needs your ${sim.fileLabel}`,
				modeList: modes.map((m) => this.modeName(m, sim.id)).join(' · '),
				status: !ready
					? 'Coming later'
					: !session
						? current
							? 'Waiting for file'
							: 'Not loaded'
						: changes
							? `${changes} unsaved`
							: 'No changes'
			};
		})
	);

	toggleManifest(open = !this.manifest) {
		if (open) {
			this.cancelCapture();
			this.closeDrawer();
		}
		this.manifest = open;
	}

	/** What the "Binding for" block's file line says. */
	fileLine = $derived(fileLine(this.games.current));

	setMode(mode: Mode) {
		this.cancelCapture();
		this.mode = mode;
		if (this.games.current) this.persist(this.games.current);
		this.cat = 'All';
		this.q = '';
		this.last = null;
		this.lastActs = [];
		this.flight = enterMode(this.flight);
		this.footStop = null;
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
	#cannotBind(bind: Bind, target: SlotRef): string | null {
		const sim = simById(this.sim);
		for (const input of [bind.input, ...(bind.modifiers ?? [])]) {
			if ('deviceId' in input && input.deviceId.startsWith('browser-')) {
				return "Your browser doesn't report this controller's USB id, so a bind on it couldn't be saved.";
			}
			const reason = sim.cannotBind?.(input);
			if (reason) return reason;
		}
		const other = this.store.bindings[target.actionId]?.[target.slot === 0 ? 1 : 0] ?? null;
		return sim.refuse?.(bind, other) ?? null;
	}

	/** The current game's word for `text`, where it has its own (Decoupled for FA off). */
	say(text: string): string {
		return simById(this.sim).words?.text?.[text] ?? text;
	}

	/** The current game's name for a mode tab: Vehicle in Star Citizen, SRV in Elite. */
	modeName(mode: Mode, sim: SimId = this.sim): string {
		return simById(sim).words?.modes?.[mode] ?? MODE_NAMES[mode];
	}

	/**
	 * Effects some action in the current file has, by mode: a status chip or HUD readout
	 * nothing can drive never shows.
	 */
	effectsIn = $derived(
		Object.fromEntries(
			MODES.map((m) => [
				m,
				this.store.actionsIn(m).flatMap((a) => (a.effect ? a.effect.split('|') : []))
			])
		) as Record<Mode, string[]>
	);

	/** Some action in `mode` (the current one by default) has `effect`. */
	has(effect: string, mode: Mode = this.mode): boolean {
		return this.effectsIn[mode].includes(effect);
	}

	#onCandidate(bind: Bind) {
		const cap = this.cap;
		if (!cap) return;
		const reason = this.#cannotBind(bind, cap.target);
		if (reason) {
			this.capNotice = `${reason} Try another.`;
			return;
		}
		this.capNotice = null;
		const action = this.actionById(cap.target.actionId);
		// An axis action takes the whole axis; a button action keeps the half it was pushed to.
		const cand = action?.axis ? { input: wholeAxis(bind.input) } : bind;
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
					(input.kind === 'axis' || input.kind === 'pad') &&
					input.half &&
					axisValueKey(slot.input) !== null &&
					sameInput(slot.input, wholeAxis(input))
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
		if (!pressed || !this.loaded || this.blocked) return;
		if (this.editor) {
			// Not listening: a press jumps to the action it fires.
			const owner = this.matching(input)[0]?.action;
			if (owner) this.ed = { ...this.ed, sel: owner.id, cat: 'All', filter: 'all', q: '' };
			return;
		}
		const hits = this.matching(input);
		let flight = this.flight;
		// Panels say they "would open" (their effect is `panel`). An action with no effect
		// of its own only shows in the last-input toast: nothing would open for Thrust left.
		for (const { action, effect } of hits) {
			if (effect) flight = act(flight, effect, action.name);
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
		const key = input && axisValueKey(wholeAxis(input));
		if (!key) return;
		// The hub names a paired controller's axes by the file device it stands for.
		const value = this.hub.axes.get(key);
		if (value !== undefined) this.flight = setThrottle(this.flight, value);
	}

	/**
	 * Bound axes in this mode as they are now, for the 3D scene to fly or drive by: pitch,
	 * roll and yaw for the ship, steering and drive speed for the SRV, move and look on
	 * foot. Nothing while listening for a rebind or with a drawer open: the vehicle (or
	 * the pilot) freezes, as the mock flight does.
	 */
	analog = $derived.by((): Analog => {
		const idle = this.cap !== null || this.blocked;
		return analogAxes(
			this.store.actionsIn(this.mode),
			this.store.bindings,
			idle ? null : this.hub.axes
		);
	});

	/**
	 * Effects whose binds are held down right now in this mode (walk directions, sprint),
	 * for the on-foot walker: presses still fire through `onInput` as before; this only
	 * says what is still down. Empty while listening for a rebind or with a drawer open.
	 */
	held = $derived.by((): ReadonlySet<string> => {
		if (this.cap !== null || this.blocked || this.mode !== 'foot') return NO_HELD;
		return heldEffects(this.store.actionsIn(this.mode), this.store.bindings, (input) =>
			this.hub.held.has(inputKey(input))
		);
	});

	/**
	 * On foot, the 3D scene's stop zone the pilot stands in (1–7), and the stops visited
	 * this visit. The scene reports them; the HUD shows the stop's prompts.
	 */
	footStop = $state<number | null>(null);
	footDone = $state.raw<readonly number[]>([]);

	/** The 3D on-foot scene says the pilot entered (or left) a stop zone. */
	enterStop(n: number | null) {
		this.footStop = n;
		if (n !== null && !this.footDone.includes(n)) this.footDone = [...this.footDone, n];
	}

	/**
	 * The viewport's camera button: the same as pressing a bound Toggle camera, so it's
	 * ignored at the same times (listening for a rebind, a drawer or dialog open).
	 */
	toggleCamera() {
		if (this.cap || this.blocked || !this.loaded) return;
		this.flight = act(this.flight, 'camera', 'Toggle camera');
	}

	step() {
		if (this.loaded && !this.editor) this.flight = tick(this.flight, this.mode);
	}

	// Files out.

	/** "Export <ABBR> preset": the current game, every mode. The original is never edited. */
	exportPreset(): boolean {
		const session = this.games.current;
		return session ? exportSession(session) : false;
	}

	/**
	 * Leave's "Export all N games": one new preset file per game with changes, a moment
	 * apart, as browsers are warier of several downloads fired at once. Resolves with how
	 * many were handed to the browser.
	 */
	async exportAll(gap = 400): Promise<number> {
		const changed = [...this.games.sessions.values()].filter((s) => s.store.changes > 0);
		let n = 0;
		for (const [i, session] of changed.entries()) {
			if (i) await new Promise((r) => setTimeout(r, gap));
			if (exportSession(session)) n++;
		}
		return n;
	}

	persist(session: Session | null = this.games.current) {
		const file = session?.store.file;
		if (!session?.remember || !file) return;
		saveLayout(this.base, {
			sim: session.sim,
			label: fileLine(session).replace(/^Pilot's binds · /, ''),
			source: file.parsed.source,
			edits: session.store.edits(),
			mode: session.mode
		});
	}

	/** Ticks or unticks "Remember this layout" for the current game only. */
	setRemember(on: boolean) {
		const session = this.games.current;
		if (!session) {
			this.#rememberNext = on;
			return;
		}
		session.remember = on;
		if (on) this.persist(session);
		else clearLayout(this.base, session.sim);
	}

	leaveNow() {
		window.location.href = this.config.homeUrl;
	}
}

/** What the "Binding for" block's file line says for a game. */
export function fileLine(session: Session | null | undefined): string {
	const origin = session?.store.file?.origin;
	if (!origin) return '';
	if (origin.kind === 'preset') return `Pilot's binds · ${origin.label}`;
	if (origin.kind === 'upload') return origin.fileName;
	return origin.label;
}

function exportSession(session: Session): boolean {
	const name = session.store.file?.parsed.presetName || 'Custom';
	const out = session.store.exportFile(`${name} rebound`);
	if (!out) return false;
	download(out.fileName, out.text);
	return true;
}

const KEY = Symbol('orbital-preflight');

export function setOrbitalPreflight(app: OrbitalPreflight) {
	setContext(KEY, app);
}

export function useOrbitalPreflight(): OrbitalPreflight {
	return getContext<OrbitalPreflight>(KEY);
}
