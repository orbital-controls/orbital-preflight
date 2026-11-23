import { describe, expect, it } from 'vitest';
import type { Action, BindingMap, InputId } from '../types.ts';
import {
	mapInput,
	nudgeCamera,
	pathThrough,
	project,
	stepCamera,
	VIEW_H,
	VIEW_W,
	type Camera,
	type Limits
} from './map-camera.ts';

const LIMITS: Limits = { pitch: [5, 89], dist: [10, 400], height: 100, radius: 50 };
const start = (): Camera => ({
	yaw: 0,
	pitch: 30,
	dist: 100,
	focus: { x: 0, y: 0, z: 0 },
	glide: null
});
const run = (n: number, input: Parameters<typeof stepCamera>[1]) => {
	let c = start();
	for (let i = 0; i < n; i++) c = stepCamera(c, input, LIMITS);
	return c;
};

describe('map camera', () => {
	it('looks at its focus, in the middle of the view', () => {
		const p = project(start(), { x: 0, y: 0, z: 0 });
		expect(p.x).toBeCloseTo(VIEW_W / 2);
		expect(p.y).toBeCloseTo(VIEW_H / 2);
	});

	it('at rest, a tick hands back the same camera', () => {
		const c = start();
		expect(stepCamera(c, {}, LIMITS)).toBe(c);
	});

	it('pitch and zoom stay within the map’s limits', () => {
		expect(run(200, { pitch: 1 }).pitch).toBe(89);
		expect(run(400, { zoom: 1 }).dist).toBe(10);
		expect(run(400, { zoom: -1 }).dist).toBe(400);
		expect(run(400, { z: 1 }).focus.y).toBe(100);
		const out = run(400, { x: 1 }).focus;
		expect(Math.hypot(out.x, out.z)).toBeCloseTo(50);
	});

	it('pans the way it faces, and Map up / down hold turns forward into up', () => {
		const fwd = stepCamera(start(), { y: 1 }, LIMITS);
		// Yaw 0 looks down -z.
		expect(fwd.focus.z).toBeLessThan(0);
		expect(fwd.focus.x).toBeCloseTo(0);
		const up = stepCamera(start(), { y: 1, zHold: true }, LIMITS);
		expect(up.focus.y).toBeGreaterThan(0);
		expect(up.focus.z).toBeCloseTo(0);
	});

	it('glides to a point, and panning stops the glide', () => {
		let c: Camera = { ...start(), glide: { x: 10, y: 0, z: 5 } };
		for (let i = 0; i < 60; i++) c = stepCamera(c, {}, LIMITS);
		expect(c.focus).toEqual({ x: 10, y: 0, z: 5 });
		expect(c.glide).toBeNull();
		const gliding: Camera = { ...start(), glide: { x: 10, y: 0, z: 5 } };
		expect(stepCamera(gliding, { x: 1 }, LIMITS).glide).toBeNull();
	});

	it('a press nudges it; other effects leave it alone', () => {
		expect(nudgeCamera(start(), 'mapYawR', LIMITS).yaw).toBeGreaterThan(0);
		const c = start();
		expect(nudgeCamera(c, 'fire', LIMITS)).toBe(c);
	});

	it('a path breaks where it passes behind the camera', () => {
		const c = start();
		expect(
			pathThrough(c, [
				{ x: -5, y: 0, z: 0 },
				{ x: 5, y: 0, z: 0 }
			])
		).toMatch(/^M[\d.]+ [\d.]+L/);
		// Far behind the camera, at +z.
		expect(pathThrough(c, [{ x: 0, y: 0, z: 1000 }])).toBe('');
	});
});

describe('mapInput', () => {
	const action = (id: string, effect: string, axis = false): Action => ({
		id,
		name: id,
		category: 'Galaxy map',
		mode: 'ship',
		effect,
		...(axis && { axis: true })
	});
	const actions = [
		action('CamYawLeft', 'mapYawL'),
		action('CamYawRight', 'mapYawR'),
		action('CamTranslateZHold', 'mapZHold'),
		action('CamZoomAxis', 'mapZoomOut|mapZoomIn', true),
		action('UI_Select', 'uiSelect')
	];
	const key = (code: string): InputId => ({ kind: 'key', code });
	const bindings: BindingMap = {
		CamYawLeft: [{ input: key('KeyQ') }, null],
		CamYawRight: [{ input: key('KeyE'), modifiers: [key('ShiftLeft')] }, null],
		CamTranslateZHold: [{ input: key('KeyR') }, null],
		CamZoomAxis: [{ input: { kind: 'axis', deviceId: 'T16000M', axis: 'Joy_ZAxis' } }, null],
		UI_Select: [{ input: key('Space') }, null]
	};
	const down =
		(...codes: string[]) =>
		(i: InputId) =>
			i.kind === 'key' && codes.includes(i.code);
	const none = () => undefined;

	it('reads held keys, their modifiers and Map up / down hold', () => {
		expect(mapInput(actions, bindings, down('KeyQ'), none)).toEqual({ yaw: -1 });
		expect(mapInput(actions, bindings, down('KeyE'), none)).toEqual({});
		expect(mapInput(actions, bindings, down('KeyE', 'ShiftLeft', 'KeyR'), none)).toEqual({
			yaw: 1,
			zHold: true
		});
		// Q and E together cancel out; menu binds move nothing.
		expect(mapInput(actions, bindings, down('KeyQ', 'KeyE', 'ShiftLeft', 'Space'), none)).toEqual({
			yaw: 0
		});
	});

	it('reads a bound axis by its halves, past the deadzone', () => {
		const at = (v: number) => mapInput(actions, bindings, down(), () => v);
		expect(at(0.02)).toEqual({});
		expect(at(1).zoom).toBeCloseTo(1);
		expect(at(-0.5).zoom).toBeLessThan(0);
	});
});
