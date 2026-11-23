import { axisValueKey } from '../bindings.ts';
import type { Action, BindingMap, InputId } from '../types.ts';
import { shape } from './analog.ts';

/**
 * The camera Elite's two maps share. The galaxy map and the system map are different
 * screens, but the game drives both cameras with the same "Galaxy map" binds: pitch and
 * yaw circle a focus point, the translate binds pan it (forward/back, left/right,
 * up/down), zoom closes in or backs off, and Map up / down hold turns forward/back into
 * up/down. Each map (`galaxy-map.ts`, `system-map.ts`) keeps a `Camera` with its own
 * limits and draws its own world through `project`.
 *
 * Buttons and keys nudge the camera on each press and keep it moving while held; a bound
 * axis moves it as far as it's pushed. UNVERIFIED: which way each axis turns the game's
 * camera (stick forward is taken as pitch down, zoom in, pan forward and pan down).
 *
 * Pure: the page ticks a camera with `stepCamera` and the map's own presses.
 */

export interface Vec {
	x: number;
	y: number;
	z: number;
}

export interface Camera {
	/** Degrees around the focus. */
	yaw: number;
	/** Degrees above the plane. */
	pitch: number;
	/** Distance from the focus. */
	dist: number;
	focus: Vec;
	/** Where the focus is gliding to (after a pick or Map home). Panning stops it. */
	glide: Vec | null;
}

/** How far a map's camera may go. */
export interface Limits {
	pitch: [number, number];
	dist: [number, number];
	/** How far the focus may leave the plane, either way. */
	height: number;
	/** How far the focus may go from the middle of the map, along the plane. */
	radius: number;
}

/** What the camera is told to do this tick, each -1..1 (0 or absent: nothing). */
export interface MapInput {
	/** Positive tilts the camera up, to look down on the plane. */
	pitch?: number;
	/** Positive turns the camera right. */
	yaw?: number;
	/** Positive pans right. */
	x?: number;
	/** Positive pans forward, the way the camera faces. */
	y?: number;
	/** Positive pans up, out of the plane. */
	z?: number;
	/** Positive zooms in. */
	zoom?: number;
	/** Map up / down hold is down: forward/back pans up/down instead. */
	zHold?: boolean;
}

type Control = Exclude<keyof MapInput, 'zHold'>;

/** The camera effects the map binds carry (`Cam…` in Elite), and what each one moves. */
const CONTROLS: Record<string, [Control, 1 | -1]> = {
	mapPitchUp: ['pitch', 1],
	mapPitchDn: ['pitch', -1],
	mapYawR: ['yaw', 1],
	mapYawL: ['yaw', -1],
	mapRight: ['x', 1],
	mapLeft: ['x', -1],
	mapFwd: ['y', 1],
	mapBack: ['y', -1],
	mapUp: ['z', 1],
	mapDown: ['z', -1],
	mapZoomIn: ['zoom', 1],
	mapZoomOut: ['zoom', -1]
};

/** The effect moves the camera (Map up / down hold included). */
export function isCameraEffect(effect: string): boolean {
	return effect in CONTROLS || effect === 'mapZHold';
}

/** Per tick at full deflection. Pans are a share of the camera's distance. */
const RATE = { pitch: 2, yaw: 3, pan: 0.02, zoom: 0.04 };

/** A press moves the camera this many ticks' worth at once, so taps and wheel clicks show. */
const NUDGE = 4;

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

/** `p`, pulled back along the plane to `radius` from the middle if it's further. */
function within(p: Vec, radius: number): Vec {
	const r = Math.hypot(p.x, p.z);
	return r <= radius ? p : { ...p, x: (p.x * radius) / r, z: (p.z * radius) / r };
}

/** Moves the camera by `input` for `ticks` ticks. */
function move<C extends Camera>(c: C, input: MapInput, ticks: number, limits: Limits): C {
	const pitch = input.pitch ?? 0;
	const yaw = input.yaw ?? 0;
	const zoom = input.zoom ?? 0;
	const x = input.x ?? 0;
	const y = input.zHold ? 0 : (input.y ?? 0);
	const z = (input.z ?? 0) + (input.zHold ? (input.y ?? 0) : 0);
	if (!pitch && !yaw && !zoom && !x && !y && !z) return c;
	// Panning is in the camera's own frame, flattened onto the plane, at a speed that
	// grows with the distance so a pan feels the same close in and far out.
	const step = c.dist * RATE.pan * ticks;
	const rad = (c.yaw * Math.PI) / 180;
	const fwd = { x: -Math.sin(rad), z: -Math.cos(rad) };
	const right = { x: Math.cos(rad), z: -Math.sin(rad) };
	const panned = Boolean(x || y || z);
	return {
		...c,
		pitch: clamp(c.pitch + pitch * RATE.pitch * ticks, ...limits.pitch),
		yaw: (((c.yaw + yaw * RATE.yaw * ticks) % 360) + 360) % 360,
		dist: clamp(c.dist * (1 - zoom * RATE.zoom) ** ticks, ...limits.dist),
		focus: panned
			? within(
					{
						x: c.focus.x + (fwd.x * y + right.x * x) * step,
						y: clamp(c.focus.y + z * step, -limits.height, limits.height),
						z: c.focus.z + (fwd.z * y + right.z * x) * step
					},
					limits.radius
				)
			: c.focus,
		glide: panned ? null : c.glide
	};
}

/** One tick: the camera moves by what's held and pushed, and a glide closes in. */
export function stepCamera<C extends Camera>(c: C, input: MapInput, limits: Limits): C {
	const next = move(c, input, 1, limits);
	if (!next.glide) return next;
	const to = next.glide;
	const f = next.focus;
	const k = 0.25;
	const close = Math.hypot(to.x - f.x, to.y - f.y, to.z - f.z) < 0.05;
	return {
		...next,
		focus: close
			? to
			: { x: f.x + (to.x - f.x) * k, y: f.y + (to.y - f.y) * k, z: f.z + (to.z - f.z) * k },
		glide: close ? null : to
	};
}

/** One press of a camera bind: a nudge. Anything else leaves the camera as it is. */
export function nudgeCamera<C extends Camera>(c: C, effect: string, limits: Limits): C {
	const control = CONTROLS[effect];
	if (!control) return c;
	const [axis, sign] = control;
	return move(c, { [axis]: sign }, NUDGE, limits);
}

/**
 * The camera input from the map binds as they are now: held buttons and keys push their
 * control all the way; a bound axis pushes it as far as it's moved, its `neg|pos` effects
 * naming which way each half goes. Pure: `isDown` says whether an input is down, `axis`
 * gives an axis's value (`deviceId:axis` → -1..1) or undefined.
 */
export function mapInput(
	actions: readonly Action[],
	bindings: BindingMap,
	isDown: (input: InputId) => boolean,
	axis: (key: string) => number | undefined
): MapInput {
	const out: MapInput = {};
	const add = (effect: string, amount: number) => {
		const control = CONTROLS[effect];
		if (!control || !amount) return;
		const [key, sign] = control;
		out[key] = clamp((out[key] ?? 0) + sign * amount, -1, 1);
	};
	for (const action of actions) {
		if (!action.effect) continue;
		const slots = bindings[action.id] ?? [];
		if (action.axis) {
			const [neg, pos] = action.effect.split('|');
			const key = axisValueKey(slots[0]?.input);
			const value = key ? shape(axis(key) ?? 0) : 0;
			if (value < 0) add(neg, -value);
			if (value > 0) add(pos, value);
			continue;
		}
		const held = slots.some(
			(slot) => slot && isDown(slot.input) && (slot.modifiers ?? []).every(isDown)
		);
		if (!held) continue;
		if (action.effect === 'mapZHold') out.zHold = true;
		else add(action.effect, 1);
	}
	return out;
}

// Drawing.

export const VIEW_W = 900;
export const VIEW_H = 560;
const FOCAL = 760;

export interface Projected {
	x: number;
	y: number;
	/** Screen pixels per world unit at that depth. */
	scale: number;
	/** Distance in front of the camera; at or below `NEAR` it's behind. */
	depth: number;
}

export const NEAR = 0.1;

/** Where a point lands on the 900 × 560 view. */
export function project(c: Camera, p: Vec): Projected {
	const yaw = (c.yaw * Math.PI) / 180;
	const pitch = (c.pitch * Math.PI) / 180;
	// The camera sits up and back from the focus and looks at it.
	const back = {
		x: Math.cos(pitch) * Math.sin(yaw),
		y: Math.sin(pitch),
		z: Math.cos(pitch) * Math.cos(yaw)
	};
	const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
	const up = {
		x: back.y * right.z - back.z * right.y,
		y: back.z * right.x - back.x * right.z,
		z: back.x * right.y - back.y * right.x
	};
	const d = { x: p.x - c.focus.x, y: p.y - c.focus.y, z: p.z - c.focus.z };
	const dot = (a: Vec) => d.x * a.x + d.y * a.y + d.z * a.z;
	const depth = c.dist - dot(back);
	const scale = depth > NEAR ? FOCAL / depth : 0;
	return { x: VIEW_W / 2 + dot(right) * scale, y: VIEW_H / 2 - dot(up) * scale, scale, depth };
}

/** A polyline through `points` as an SVG path, broken where it passes behind the camera. */
export function pathThrough(c: Camera, points: readonly Vec[]): string {
	let d = '';
	let pen = false;
	for (const point of points) {
		const p = project(c, point);
		if (p.depth <= NEAR) {
			pen = false;
			continue;
		}
		d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		pen = true;
	}
	return d;
}
