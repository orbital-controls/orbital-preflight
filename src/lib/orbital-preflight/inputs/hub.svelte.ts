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
	/** The file device it stands for, once paired. */
	deviceId: string | null;
	/** Paired by USB id, or by the pilot pressing a button. */
	pairedBy: 'usb' | 'press' | null;
}

export interface InputEvent {
	input: InputId;
	pressed: boolean;
}

const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight']);
/** Keys the browser keeps: focus moves, reloads, devtools, fullscreen. */
const BROWSER_KEYS = new Set(['Tab', 'F5', 'F11', 'F12']);
const AXIS_PRESS = 0.5;

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

	#heldInputs = new Map<string, InputId>();
	#listeners = new Set<(event: InputEvent) => void>();
	#capture: ((bind: Bind) => void) | null = null;
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

	/** The next press becomes the candidate. Call again to pick another. */
	capture(callback: (bind: Bind) => void) {
		this.#capture = callback;
	}

	stopCapture() {
		this.#capture = null;
	}

	/** "Press a button on your stick": the next controller button pairs that controller. */
	pairNext(callback: ((pad: BrowserPad) => void) | null) {
		this.#pairNext = callback;
	}

	isHeld(input: InputId): boolean {
		return this.held.has(inputKey(input));
	}

	/** A held modifier, other than `input` itself. */
	#heldModifier(input: InputId): InputId | undefined {
		for (const [key, held] of this.#heldInputs) {
			if (key === inputKey(input)) continue;
			if (held.kind === 'key' && MODIFIER_CODES.has(held.code)) return held;
		}
		return undefined;
	}

	press(input: InputId) {
		const key = inputKey(input);
		if (this.held.has(key)) return;
		this.held.add(key);
		this.#heldInputs.set(key, input);
		this.last = input;

		if (this.#capture) {
			// A modifier on its own waits for the key it modifies.
			if (input.kind === 'key' && MODIFIER_CODES.has(input.code)) return;
			const modifier = this.#heldModifier(input);
			this.#capture(modifier ? { input, modifier } : { input });
			return;
		}
		for (const listener of this.#listeners) listener({ input, pressed: true });
	}

	release(input: InputId) {
		const key = inputKey(input);
		if (!this.held.delete(key)) return;
		const wasModifierOnly = this.#capture && input.kind === 'key' && MODIFIER_CODES.has(input.code);
		this.#heldInputs.delete(key);
		// Releasing a lone modifier while listening binds the modifier itself.
		if (wasModifierOnly && this.#capture && ![...this.#heldInputs.values()].length) {
			this.#capture({ input });
			return;
		}
		if (this.#capture) return;
		for (const listener of this.#listeners) listener({ input, pressed: false });
	}

	/** Which modifier keys are held now, for matching binds that need one. */
	modifierHeld(modifier: InputId | undefined): boolean {
		return !modifier || this.held.has(inputKey(modifier));
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
			// While listening, Space and arrows would scroll the page and Enter would click
			// the focused button. Only then, so keyboard users can still drive the UI.
			if (this.capturing && !shortcut) event.preventDefault();
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
			const state = this.#padState.get(pad.index) ?? { buttons: [], axes: [], hats: new Set<number>() };
			this.#padState.set(pad.index, state);

			pad.buttons.forEach((button, i) => {
				const down = button.pressed || button.value > AXIS_PRESS;
				if (down === Boolean(state.buttons[i])) return;
				state.buttons[i] = down;
				if (down && this.#pairNext && info && !info.deviceId) {
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
				if (Math.abs(value - previous) > 0.002) this.axes.set(`${deviceId}:${name}`, value);
				// Crossing the halfway mark counts as a press, for rebinding an axis and for
				// button actions bound to one half of it.
				for (const half of ['pos', 'neg'] as const) {
					const sign = half === 'pos' ? 1 : -1;
					const was = previous * sign > AXIS_PRESS;
					const is = value * sign > AXIS_PRESS;
					if (was === is) continue;
					const input: InputId = { kind: 'axis', deviceId, axis: name, half };
					if (is) {
						if (this.capturing) this.press({ kind: 'axis', deviceId, axis: name });
						else this.press(input);
					} else {
						this.release(input);
						this.release({ kind: 'axis', deviceId, axis: name });
					}
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
			seen.length === this.pads.length && seen.every((g) => this.pads.some((p) => p.index === g.index && p.id === g.id));
		if (same) return;
		const taken = new Set(this.pads.map((p) => p.deviceId).filter((id): id is string => Boolean(id)));
		this.pads = seen.map((g) => {
			const existing = this.pads.find((p) => p.index === g.index && p.id === g.id);
			if (existing) return existing;
			const match = matchDevice(g.id, this.devices, taken);
			if (match) taken.add(match.id);
			return {
				index: g.index,
				id: g.id,
				name: parseGamepadId(g.id).name,
				buttons: g.buttons.length,
				axes: g.axes.length,
				deviceId: match?.id ?? null,
				pairedBy: match ? 'usb' : null
			};
		});
		for (const index of this.#padState.keys()) {
			if (!seen.some((g) => g.index === index)) this.#padState.delete(index);
		}
	}

	/** Pairs a browser controller with a device from the file, or unpairs it. */
	pair(index: number, deviceId: string | null, by: BrowserPad['pairedBy'] = 'press') {
		this.releaseAll();
		this.pads = this.pads.map((p) => {
			if (p.index === index) return { ...p, deviceId, pairedBy: deviceId ? by : null };
			// One controller per file device.
			if (deviceId && p.deviceId === deviceId) return { ...p, deviceId: null, pairedBy: null };
			return p;
		});
	}

	/** Re-runs USB pairing when a new file brings different devices. */
	repair() {
		const taken = new Set<string>();
		this.pads = this.pads.map((p) => {
			const match = matchDevice(p.id, this.devices, taken);
			if (match) taken.add(match.id);
			return { ...p, deviceId: match?.id ?? null, pairedBy: match ? 'usb' : null };
		});
	}
}
