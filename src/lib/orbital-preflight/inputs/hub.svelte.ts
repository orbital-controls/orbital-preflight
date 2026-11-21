/* eslint-disable svelte/prefer-svelte-reactivity -- the private Maps and Sets here are
   polling bookkeeping, never read by a template; what the UI reads (held, axes, pads)
   is reactive. */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { inputKey } from '../bindings.ts';
import type { Bind, FileDevice, InputId } from '../types.ts';
import { AXIS_NAMES, hatDirections, looksLikeHat, matchDevice, parseGamepadId } from './gamepad.ts';

/** A controller the browser has shown us. */
export interface BrowserPad {
	index: number;
	/** `Gamepad.id` as the browser reports it. */
	id: string;
	name: string;
	buttons: number;
	axes: number;
	/**
	 * The device id binds made on it carry: a device from the file once paired, or a new
	 * one built from its USB id (`new`) when the file has no match. `null` when the
	 * browser doesn't report a USB id, so nothing bound on it could be saved.
	 */
	deviceId: string | null;
	/** Matched to the file by USB id, paired by the pilot pressing a button, or not in the file. */
	pairedBy: 'usb' | 'press' | 'new' | null;
}

/** How one controller was paired, kept per game while another game is current. */
export type PadPairing = Pick<BrowserPad, 'index' | 'id' | 'deviceId' | 'pairedBy'>;

export interface InputEvent {
	input: InputId;
	pressed: boolean;
}

const MODIFIER_CODES = new Set([
	'ShiftLeft',
	'ShiftRight',
	'ControlLeft',
	'ControlRight',
	'AltLeft',
	'AltRight'
]);
/** Keys the browser keeps: focus moves, reloads, devtools, fullscreen. */
const BROWSER_KEYS = new Set(['Tab', 'F5', 'F11', 'F12']);
const AXIS_PRESS = 0.5;
const ACTIVATE_KEYS = new Set(['Enter', 'NumpadEnter', 'Space']);

function isModifier(input: InputId): boolean {
	return input.kind === 'key' && MODIFIER_CODES.has(input.code);
}

/** The rebind card's and the editor's buttons mark themselves with this attribute. */
function onCaptureControls(event: Event): boolean {
	const el = event.target as HTMLElement | null;
	return Boolean(el?.closest?.('[data-op-capture-controls]'));
}

/**
 * Every physical input, in one place. Keyboard, mouse and controllers all arrive as
 * `InputId`s; the input deck reads `held` to light its keys, and clicks on the deck come
 * back in through `press`/`release`, so testing without hardware takes the same path.
 *
 * While `capturing` is set (the rebind card is listening), inputs go to the capture
 * callback only, and nothing reaches the mock flight.
 */
export class InputHub {
	held = new SvelteSet<string>();
	/** Axis values by `deviceId:axis`, -1..1. */
	axes = new SvelteMap<string, number>();
	pads = $state<BrowserPad[]>([]);
	last = $state.raw<InputId | null>(null);
	/** The file's devices, for pairing. */
	devices = $state.raw<FileDevice[]>([]);
	/**
	 * The sim's id for a controller the file doesn't name, from its USB ids (Elite writes
	 * unknown devices as vendor + product, e.g. `231D0200`). Set from the sim adapter.
	 */
	newDeviceId: ((vendor: string, product: string) => string | null) | null = null;

	#heldInputs = new Map<string, InputId>();
	#listeners = new Set<(event: InputEvent) => void>();
	#axisListeners = new Set<(key: string, value: number) => void>();
	#capture: ((bind: Bind) => void) | null = null;
	#cancel: (() => void) | null = null;
	/** A modifier pressed alone while listening; it becomes the bind if nothing joins it. */
	#loneModifier: InputId | null = null;
	#pairNext: ((pad: BrowserPad) => void) | null = null;
	#padState = new Map<number, { buttons: boolean[]; axes: number[]; hats: Set<number> }>();
	#frame = 0;

	get capturing(): boolean {
		return this.#capture !== null;
	}

	/** Mock-flight and HUD listeners. Returns an unsubscribe. */
	subscribe(listener: (event: InputEvent) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Called when an axis moves, with its `deviceId:axis` key. Returns an unsubscribe. */
	subscribeAxes(listener: (key: string, value: number) => void): () => void {
		this.#axisListeners.add(listener);
		return () => this.#axisListeners.delete(listener);
	}

	/**
	 * While listening, every press becomes the candidate (pressing again picks another).
	 * Esc calls `oncancel`; Enter and Space still work the card's own buttons.
	 */
	capture(callback: (bind: Bind) => void, oncancel?: () => void) {
		this.#capture = callback;
		this.#cancel = oncancel ?? null;
		this.#loneModifier = null;
	}

	stopCapture() {
		this.#capture = null;
		this.#cancel = null;
		this.#loneModifier = null;
	}

	/** "Press a button on your stick": the next controller button pairs that controller. */
	pairNext(callback: ((pad: BrowserPad) => void) | null) {
		this.#pairNext = callback;
	}

	isHeld(input: InputId): boolean {
		return this.held.has(inputKey(input));
	}

	/** Modifier keys held now, other than `input` itself. */
	#heldModifiers(input: InputId): InputId[] {
		const mods: InputId[] = [];
		for (const [key, held] of this.#heldInputs) {
			if (key !== inputKey(input) && isModifier(held)) mods.push(held);
		}
		return mods;
	}

	press(input: InputId) {
		const key = inputKey(input);
		if (this.held.has(key)) return;
		this.held.add(key);
		this.#heldInputs.set(key, input);
		this.last = input;

		if (this.#capture) {
			// A modifier on its own waits for the key it modifies; if none comes before it's
			// let go, the modifier itself is the bind.
			if (isModifier(input)) {
				this.#loneModifier = input;
				return;
			}
			this.#loneModifier = null;
			const modifiers = this.#heldModifiers(input);
			this.#capture(modifiers.length ? { input, modifiers } : { input });
			return;
		}
		for (const listener of this.#listeners) listener({ input, pressed: true });
	}

	release(input: InputId) {
		const key = inputKey(input);
		if (!this.held.delete(key)) return;
		this.#heldInputs.delete(key);
		if (this.#capture) {
			if (this.#loneModifier && inputKey(this.#loneModifier) === key) {
				this.#loneModifier = null;
				this.#capture({ input });
			}
			return;
		}
		for (const listener of this.#listeners) listener({ input, pressed: false });
	}

	/** Whether every modifier a bind needs is held now. */
	modifiersHeld(modifiers: InputId[] | undefined): boolean {
		return (modifiers ?? []).every((m) => this.held.has(inputKey(m)));
	}

	releaseAll() {
		for (const input of [...this.#heldInputs.values()]) this.release(input);
	}

	/** Wires keyboard, mouse and controllers to `target`. Returns a teardown. */
	attach(target: Window): () => void {
		const typing = (event: Event) => {
			const el = event.target as HTMLElement | null;
			return Boolean(el?.closest?.('input, textarea, select, [contenteditable="true"]'));
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (typing(event) || BROWSER_KEYS.has(event.code)) return;
			// Ctrl and Cmd combinations stay the browser's. The key still lights up, but
			// the default isn't prevented.
			const shortcut = (event.ctrlKey || event.metaKey) && !MODIFIER_CODES.has(event.code);
			if (this.capturing) {
				// Esc leaves the rebind card, as it closes any dialog.
				if (event.code === 'Escape') {
					event.preventDefault();
					this.#cancel?.();
					return;
				}
				// Enter and Space on the card's own buttons (Apply, Swap…) press them.
				if (ACTIVATE_KEYS.has(event.code) && onCaptureControls(event)) return;
				// Otherwise Space and arrows would scroll the page and Enter would click the
				// focused slot. Only while listening, so the UI stays usable from the keyboard.
				if (!shortcut) event.preventDefault();
			}
			if (event.repeat) return;
			this.press({ kind: 'key', code: event.code });
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (BROWSER_KEYS.has(event.code)) return;
			this.release({ kind: 'key', code: event.code });
		};
		const onMouseDown = (event: MouseEvent) => {
			if (!this.#mouseTarget(event)) return;
			if (this.capturing) event.preventDefault();
			this.press({ kind: 'mouse', button: event.button });
		};
		const onMouseUp = (event: MouseEvent) => this.release({ kind: 'mouse', button: event.button });
		const onWheel = (event: WheelEvent) => {
			if (!this.#mouseTarget(event)) return;
			const input: InputId = { kind: 'wheel', dir: event.deltaY < 0 ? 'up' : 'down' };
			if (this.capturing) event.preventDefault();
			this.press(input);
			setTimeout(() => this.release(input), 120);
		};
		const onContextMenu = (event: MouseEvent) => {
			if (this.#mouseTarget(event)) event.preventDefault();
		};
		const onBlur = () => this.releaseAll();
		const onVisibility = () => {
			if (document.visibilityState === 'visible') this.#startPolling();
			else {
				this.#stopPolling();
				this.releaseAll();
			}
		};
		const onConnect = () => this.#startPolling();

		target.addEventListener('keydown', onKeyDown);
		target.addEventListener('keyup', onKeyUp);
		target.addEventListener('mousedown', onMouseDown);
		target.addEventListener('mouseup', onMouseUp);
		target.addEventListener('wheel', onWheel, { passive: false });
		target.addEventListener('contextmenu', onContextMenu);
		target.addEventListener('blur', onBlur);
		target.addEventListener('gamepadconnected', onConnect);
		target.addEventListener('gamepaddisconnected', onConnect);
		document.addEventListener('visibilitychange', onVisibility);
		this.#startPolling();

		return () => {
			target.removeEventListener('keydown', onKeyDown);
			target.removeEventListener('keyup', onKeyUp);
			target.removeEventListener('mousedown', onMouseDown);
			target.removeEventListener('mouseup', onMouseUp);
			target.removeEventListener('wheel', onWheel);
			target.removeEventListener('contextmenu', onContextMenu);
			target.removeEventListener('blur', onBlur);
			target.removeEventListener('gamepadconnected', onConnect);
			target.removeEventListener('gamepaddisconnected', onConnect);
			document.removeEventListener('visibilitychange', onVisibility);
			this.#stopPolling();
		};
	}

	/** Mouse binds are read over the viewport only, so the rest of the UI clicks normally. */
	#mouseTarget(event: MouseEvent): boolean {
		const el = event.target as HTMLElement | null;
		return Boolean(el?.closest?.('[data-op-mouse-zone]'));
	}

	#startPolling() {
		if (this.#frame || typeof navigator === 'undefined' || !navigator.getGamepads) return;
		const tick = () => {
			this.#poll();
			this.#frame = document.visibilityState === 'visible' ? requestAnimationFrame(tick) : 0;
		};
		this.#frame = requestAnimationFrame(tick);
	}

	#stopPolling() {
		if (this.#frame) cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}

	#poll() {
		const seen: Gamepad[] = [];
		for (const pad of navigator.getGamepads()) if (pad?.connected) seen.push(pad);
		this.#syncPads(seen);

		for (const pad of seen) {
			const info = this.pads.find((p) => p.index === pad.index);
			const deviceId = info?.deviceId ?? `browser-${pad.index}`;
			const state = this.#padState.get(pad.index) ?? {
				buttons: [],
				axes: [],
				hats: new Set<number>()
			};
			this.#padState.set(pad.index, state);

			pad.buttons.forEach((button, i) => {
				const down = button.pressed || button.value > AXIS_PRESS;
				if (down === Boolean(state.buttons[i])) return;
				state.buttons[i] = down;
				if (down && this.#pairNext && info && InputHub.unpaired(info)) {
					const callback = this.#pairNext;
					this.#pairNext = null;
					callback(info);
					return;
				}
				const input: InputId = { kind: 'button', deviceId, button: i + 1 };
				if (down) this.press(input);
				else this.release(input);
			});

			let hatNumber = 0;
			pad.axes.forEach((value, i) => {
				if (looksLikeHat(value)) state.hats.add(i);
				if (state.hats.has(i)) {
					hatNumber += 1;
					this.#hat(deviceId, hatNumber, state.axes[i], value);
					state.axes[i] = value;
					return;
				}
				const name = AXIS_NAMES[i] ?? `A${i}`;
				const previous = state.axes[i] ?? 0;
				state.axes[i] = value;
				if (Math.abs(value - previous) > 0.002) {
					const axisKey = `${deviceId}:${name}`;
					this.axes.set(axisKey, value);
					for (const listener of this.#axisListeners) listener(axisKey, value);
				}
				// Crossing the halfway mark counts as a press, for rebinding an axis and for
				// button actions bound to one half of it.
				for (const half of ['pos', 'neg'] as const) {
					const sign = half === 'pos' ? 1 : -1;
					const was = previous * sign > AXIS_PRESS;
					const is = value * sign > AXIS_PRESS;
					if (was === is) continue;
					const input: InputId = { kind: 'axis', deviceId, axis: name, half };
					// While listening this becomes the candidate; an axis action keeps the
					// whole axis (the session drops the half), a button action keeps the half.
					if (is) this.press(input);
					else this.release(input);
				}
			});
		}
	}

	#hat(deviceId: string, hat: number, before: number | undefined, after: number) {
		const was = new Set(before === undefined ? [] : hatDirections(before));
		const now = new Set(hatDirections(after));
		for (const dir of was) if (!now.has(dir)) this.release({ kind: 'hat', deviceId, hat, dir });
		for (const dir of now) if (!was.has(dir)) this.press({ kind: 'hat', deviceId, hat, dir });
	}

	#syncPads(seen: Gamepad[]) {
		const same =
			seen.length === this.pads.length &&
			seen.every((g) => this.pads.some((p) => p.index === g.index && p.id === g.id));
		if (same) return;
		// A controller that went away lets go of everything it was holding.
		for (const gone of this.pads.filter(
			(p) => !seen.some((g) => g.index === p.index && g.id === p.id)
		)) {
			this.#releaseDevice(gone.deviceId ?? `browser-${gone.index}`);
		}
		const taken = new Set(
			this.pads
				.filter((p) => p.pairedBy && p.pairedBy !== 'new')
				.map((p) => p.deviceId)
				.filter((id): id is string => Boolean(id))
		);
		this.pads = seen.map((g) => {
			const existing = this.pads.find((p) => p.index === g.index && p.id === g.id);
			if (existing) return existing;
			const pad: BrowserPad = {
				index: g.index,
				id: g.id,
				name: parseGamepadId(g.id).name,
				buttons: g.buttons.length,
				axes: g.axes.length,
				deviceId: null,
				pairedBy: null
			};
			return this.#assign(pad, taken);
		});
		for (const index of this.#padState.keys()) {
			if (!seen.some((g) => g.index === index)) this.#padState.delete(index);
		}
	}

	/** USB-match a controller to the file, or give it a new device id the file can hold. */
	#assign(pad: BrowserPad, taken: Set<string>): BrowserPad {
		const match = matchDevice(pad.id, this.devices, taken);
		if (match) {
			taken.add(match.id);
			return { ...pad, deviceId: match.id, pairedBy: 'usb' };
		}
		return this.#unpaired(pad);
	}

	#unpaired(pad: BrowserPad): BrowserPad {
		const { vendor, product } = parseGamepadId(pad.id);
		const id = vendor && product ? (this.newDeviceId?.(vendor, product) ?? null) : null;
		return { ...pad, deviceId: id, pairedBy: id ? 'new' : null };
	}

	#releaseDevice(deviceId: string) {
		for (const input of [...this.#heldInputs.values()]) {
			if ('deviceId' in input && input.deviceId === deviceId) this.release(input);
		}
	}

	/** Pairs a browser controller with a device from the file, or unpairs it (`null`). */
	pair(index: number, deviceId: string | null, by: BrowserPad['pairedBy'] = 'press') {
		this.releaseAll();
		this.pads = this.pads.map((p) => {
			if (p.index === index) return deviceId ? { ...p, deviceId, pairedBy: by } : this.#unpaired(p);
			// One controller per file device.
			if (deviceId && p.deviceId === deviceId) return this.#unpaired(p);
			return p;
		});
	}

	/** The pairing as it is now, to keep with a game that stops being current. */
	pairing(): PadPairing[] {
		return this.pads.map(({ index, id, deviceId, pairedBy }) => ({
			index,
			id,
			deviceId,
			pairedBy
		}));
	}

	/**
	 * Another game's devices, and its pairing as it was left: a controller paired by USB
	 * or by a press goes back to the same file device; one plugged in since (or never
	 * paired) is matched by USB or waits, unpaired, for the Controllers drawer.
	 */
	restore(
		devices: FileDevice[],
		newDeviceId: ((vendor: string, product: string) => string | null) | null,
		saved: readonly PadPairing[]
	) {
		this.releaseAll();
		this.devices = devices;
		this.newDeviceId = newDeviceId;
		const kept = new Map(
			saved
				.filter(
					(s) =>
						(s.pairedBy === 'usb' || s.pairedBy === 'press') &&
						devices.some((d) => d.id === s.deviceId)
				)
				.map((s) => [`${s.index}:${s.id}`, s])
		);
		const taken = new Set([...kept.values()].map((s) => s.deviceId!));
		this.pads = this.pads.map((p) => {
			const s = kept.get(`${p.index}:${p.id}`);
			return s ? { ...p, deviceId: s.deviceId, pairedBy: s.pairedBy } : this.#assign(p, taken);
		});
	}

	/** Re-runs USB pairing when a new file brings different devices. */
	repair() {
		const taken = new Set<string>();
		this.pads = this.pads.map((p) => this.#assign(p, taken));
	}

	/** Not paired with a device in the file (yet): the Controllers drawer can pair it. */
	static unpaired(pad: BrowserPad): boolean {
		return !pad.pairedBy || pad.pairedBy === 'new';
	}
}
