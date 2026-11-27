import { describe, expect, it } from 'vitest';
import { inputKey } from './bindings.ts';
import {
	CHARGE_TICKS,
	cursorSystem,
	DIST_MAX,
	DIST_MIN,
	engage,
	HOME,
	homeCamera,
	initialGalaxy,
	JUMP_RANGE,
	lightYears,
	MAP_H,
	MAP_W,
	mapDrive,
	mapHome,
	mapSelect,
	NO_DRIVE,
	pickAt,
	PITCH_MAX,
	plot,
	plotRoute,
	project,
	routeLength,
	select,
	steer,
	SYSTEMS,
	systemById,
	targetNext,
	tickGalaxy,
	toggleMap,
	type GalaxyState
} from './galaxy.ts';
import type { Action, BindingMap, InputId } from './types.ts';

const far = SYSTEMS.find((s) => s.id !== HOME && (plotRoute(HOME, s.id)?.length ?? 0) >= 3)!;

function run(g: GalaxyState, ticks: number) {
	let msg: string | undefined;
	for (let i = 0; i < ticks; i++) {
		const step = tickGalaxy(g);
		g = step.g;
		msg = step.msg ?? msg;
	}
	return { g, msg };
}

describe('the pocket', () => {
	it('is the same every visit, with unique names and ids', () => {
		expect(SYSTEMS).toHaveLength(40);
		expect(new Set(SYSTEMS.map((s) => s.id)).size).toBe(40);
		expect(systemById(HOME)?.pos).toEqual([0, 0, 0]);
	});

	it('keeps systems at least 4 ly apart', () => {
		for (const a of SYSTEMS)
			for (const b of SYSTEMS)
				if (a !== b) expect(lightYears(a.id, b.id)).toBeGreaterThanOrEqual(3.9);
	});

	it('reaches every system from home but the outlier', () => {
		const out = SYSTEMS.filter((s) => s.id !== HOME && !plotRoute(HOME, s.id)).map((s) => s.name);
		expect(out).toEqual(['Thule']);
	});
});

describe('the route plotter', () => {
	it('keeps every jump within range and ends at the destination', () => {
		const route = plotRoute(HOME, far.id)!;
		expect(route.at(-1)).toBe(far.id);
		let at = HOME;
		for (const id of route) {
			expect(lightYears(at, id)).toBeLessThanOrEqual(JUMP_RANGE);
			at = id;
		}
	});

	it('takes the fewest jumps', () => {
		const route = plotRoute(HOME, far.id)!;
		// No route with fewer jumps exists under a range that just covers the longest hop.
		expect(plotRoute(HOME, far.id, JUMP_RANGE * 3)!.length).toBeLessThanOrEqual(route.length);
		const direct = SYSTEMS.find((s) => s.id !== HOME && lightYears(HOME, s.id) <= JUMP_RANGE)!;
		expect(plotRoute(HOME, direct.id)).toEqual([direct.id]);
	});

	it('sums the route', () => {
		const route = plotRoute(HOME, far.id)!;
		const { jumps, ly } = routeLength(HOME, route);
		expect(jumps).toBe(route.length);
		expect(ly).toBeGreaterThanOrEqual(lightYears(HOME, far.id) - 0.1);
	});

	it('has no route to where you are, or out of range', () => {
		expect(plotRoute(HOME, HOME)).toBeNull();
		expect(plotRoute(HOME, 'thule')).toBeNull();
	});
});

describe('the camera', () => {
	it('projects the focus to the centre of the view', () => {
		const cam = homeCamera();
		const p = project(cam, cam.focus, 900, 560)!;
		expect(p.x).toBeCloseTo(450);
		expect(p.y).toBeCloseTo(280);
		expect(p.depth).toBeCloseTo(cam.dist);
	});

	it('draws a point above the focus higher on screen', () => {
		const cam = homeCamera();
		const up = project(cam, [0, 5, 0], 900, 560)!;
		expect(up.y).toBeLessThan(280);
	});

	it('moves forward away from the camera, and sideways to its right', () => {
		const cam = { ...homeCamera(), yaw: 0 };
		// Yaw 0: the camera sits south of the focus looking north (towards -z).
		const fwd = steer(cam, { ...NO_DRIVE, y: 1 }, 0.5);
		expect(fwd.focus[2]).toBeLessThan(0);
		const right = steer(cam, { ...NO_DRIVE, x: 1 }, 0.5);
		const p = project(cam, right.focus, 900, 560)!;
		expect(p.x).toBeGreaterThan(450);
	});

	it('keeps pitch and zoom within limits', () => {
		let cam = homeCamera();
		for (let i = 0; i < 100; i++) cam = steer(cam, { ...NO_DRIVE, pitch: 1, zoom: 1 }, 0.1);
		expect(cam.pitch).toBe(PITCH_MAX);
		expect(cam.dist).toBe(DIST_MIN);
		for (let i = 0; i < 100; i++) cam = steer(cam, { ...NO_DRIVE, zoom: -1 }, 0.1);
		expect(cam.dist).toBe(DIST_MAX);
	});

	it('hands back the same camera when nothing drives it', () => {
		const cam = homeCamera();
		expect(steer(cam, NO_DRIVE, 0.05)).toBe(cam);
	});

	it('picks the system drawn nearest a point', () => {
		const cam = homeCamera();
		const p = project(cam, far.pos, MAP_W, MAP_H)!;
		expect(pickAt(cam, p.x + 3, p.y - 2, MAP_W, MAP_H)).toBe(far.id);
		expect(cursorSystem(cam)).toBe(HOME);
	});
});

describe('the map', () => {
	it('opens on the ship’s system and closes', () => {
		const g: GalaxyState = { ...initialGalaxy(), cam: { ...homeCamera(), focus: [20, 0, 20] } };
		const open = toggleMap(g);
		expect(open.open).toBe(true);
		expect(open.cam.focus).toEqual([0, 0, 0]);
		expect(toggleMap(open).open).toBe(false);
		expect(toggleMap(open, true)).toBe(open);
	});

	it('goes home', () => {
		const g: GalaxyState = { ...initialGalaxy(), cam: { ...homeCamera(), focus: [9, 9, 9] } };
		expect(mapHome(g).cam.focus).toEqual([0, 0, 0]);
	});

	it('selects under the cursor, then plots on a second select', () => {
		let g = select(initialGalaxy(), far.id);
		g = { ...g, selected: null };
		const first = mapSelect(g);
		expect(first.g.selected).toBe(far.id);
		const second = mapSelect(first.g);
		expect(second.g.route.at(-1)).toBe(far.id);
		expect(second.g.target).toBe(second.g.route[0]);
		expect(second.msg).toMatch(/^Route plotted · \d+ jumps$/);
	});

	it('says why it can’t plot', () => {
		const g = initialGalaxy();
		expect(plot(g, HOME).msg).toBe('You are here');
		expect(plot(g, 'thule').msg).toBe('Route unavailable · out of jump range');
	});
});

describe('the route from the cockpit', () => {
	it('targets the next system, or says there is no route', () => {
		expect(targetNext(initialGalaxy()).msg).toBe('No route plotted');
		const g = plot(initialGalaxy(), far.id).g;
		const t = targetNext({ ...g, target: null });
		expect(t.g.target).toBe(g.route[0]);
		expect(t.msg).toBe(`${systemById(g.route[0])!.name} targeted`);
	});

	it('charges, jumps and targets the next system, to the destination', () => {
		let g = plot(initialGalaxy(), far.id).g;
		const hops = g.route.length;
		for (let i = 0; i < hops; i++) {
			const next = g.target!;
			const charged = engage(g);
			expect(charged.msg).toBe(`Charging FSD · jumping to ${systemById(next)!.name}`);
			const done = run(charged.g, CHARGE_TICKS);
			g = done.g;
			expect(g.location).toBe(next);
			expect(done.msg).toMatch(new RegExp(`^Arrived at ${systemById(next)!.name}`));
		}
		expect(g.location).toBe(far.id);
		expect(g.route).toEqual([]);
		expect(g.target).toBeNull();
	});

	it('does nothing to jump to with no target', () => {
		const g = initialGalaxy();
		expect(engage(g).g).toBe(g);
		expect(tickGalaxy(g).g).toBe(g);
	});
});

describe('map binds', () => {
	const action = (id: string, axis = false): Action => ({
		id,
		name: id,
		category: 'Galaxy map',
		mode: 'ship',
		context: 'galaxy map',
		...(axis && { axis: true })
	});
	const key = (code: string): InputId => ({ kind: 'key', code });
	const actions = [
		action('CamTranslateForward'),
		action('CamYawLeft'),
		action('CamTranslateZHold'),
		action('CamZoomAxis', true)
	];
	const bindings: BindingMap = {
		CamTranslateForward: [{ input: key('KeyW') }, null],
		CamYawLeft: [{ input: key('KeyQ') }, null],
		CamTranslateZHold: [{ input: key('ShiftLeft') }, null],
		CamZoomAxis: [{ input: { kind: 'axis', deviceId: 'T16000M', axis: 'Z' } }, null]
	};
	const downOf = (...codes: string[]) => {
		const keys = new Set(codes.map((c) => inputKey(key(c))));
		return (input: InputId) => keys.has(inputKey(input));
	};

	it('reads held buttons and bound axes', () => {
		const d = mapDrive(actions, bindings, downOf('KeyW', 'KeyQ'), new Map([['T16000M:Z', 0.5]]));
		expect(d.y).toBe(1);
		expect(d.yaw).toBe(-1);
		expect(d.zoom).toBeGreaterThan(0.4);
	});

	it('turns forward into up while Translate Z hold is down', () => {
		const d = mapDrive(actions, bindings, downOf('KeyW', 'ShiftLeft'), new Map());
		expect(d.y).toBe(0);
		expect(d.z).toBe(1);
	});

	it('reads nothing with nothing down', () => {
		expect(mapDrive(actions, bindings, () => false, new Map())).toEqual(NO_DRIVE);
	});
});
