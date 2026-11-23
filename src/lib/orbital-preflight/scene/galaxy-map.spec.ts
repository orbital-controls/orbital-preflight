import { describe, expect, it } from 'vitest';
import {
	distance,
	gridPaths,
	HOME_SYSTEM,
	initialGalaxyMap,
	JUMP_RANGE,
	plotRoute,
	pressGalaxyMap,
	rangePath,
	routePath,
	SYSTEMS,
	underReticle,
	type GalaxyMapState
} from './galaxy-map.ts';

/** The camera with `i` in the middle of the view. */
const lookingAt = (i: number): GalaxyMapState => ({ ...initialGalaxyMap(), focus: SYSTEMS[i].at });

/** A system a few jumps out that a route reaches. */
const far = SYSTEMS.findIndex(
	(s, i) =>
		i !== HOME_SYSTEM &&
		distance(s.at, SYSTEMS[HOME_SYSTEM].at) > 2 * JUMP_RANGE &&
		plotRoute(HOME_SYSTEM, i).length
);

describe('galaxy map', () => {
	it('the placeholder systems are the same every time, with distinct names', () => {
		expect(SYSTEMS.length).toBeGreaterThan(30);
		expect(new Set(SYSTEMS.map((s) => s.name)).size).toBe(SYSTEMS.length);
		expect(SYSTEMS[HOME_SYSTEM].at).toEqual({ x: 0, y: 0, z: 0 });
	});

	it('opens on the current system, under the reticle, with nothing selected', () => {
		const s = initialGalaxyMap();
		expect(s.sel).toBeNull();
		expect(underReticle(s)).toBe(HOME_SYSTEM);
	});

	it('plots the fewest jumps, none longer than the jump range', () => {
		expect(far).toBeGreaterThan(0);
		const route = plotRoute(HOME_SYSTEM, far);
		expect(route[0]).toBe(HOME_SYSTEM);
		expect(route.at(-1)).toBe(far);
		expect(route.length - 1).toBeGreaterThanOrEqual(3);
		for (let i = 1; i < route.length; i++)
			expect(distance(SYSTEMS[route[i - 1]].at, SYSTEMS[route[i]].at)).toBeLessThanOrEqual(
				JUMP_RANGE
			);
		// Out of reach with a tiny jump range.
		expect(plotRoute(HOME_SYSTEM, far, 1)).toEqual([]);
	});

	it('Menu select picks what’s under the reticle, then plots a route to it', () => {
		const first = pressGalaxyMap(lookingAt(far), 'uiSelect');
		expect(first.map.sel).toBe(far);
		expect(first.map.route).toEqual([]);
		const second = pressGalaxyMap(first.map, 'uiSelect');
		expect(second.map.route).toEqual(plotRoute(HOME_SYSTEM, far));
		expect(second.msg).toMatch(/^Route plotted · \d+ jumps$/);
		expect(routePath(second.map)).toMatch(/^M/);
	});

	it('with nothing under the reticle, Menu select does nothing', () => {
		const empty: GalaxyMapState = { ...initialGalaxyMap(), focus: { x: 0, y: 50, z: 0 }, dist: 10 };
		expect(underReticle(empty)).toBeNull();
		expect(pressGalaxyMap(empty, 'uiSelect').map).toBe(empty);
	});

	it('Map home flies back; Galaxy map and Menu back close it; System map does nothing here', () => {
		const s = lookingAt(far);
		expect(pressGalaxyMap(s, 'mapHome').map.glide).toEqual(SYSTEMS[HOME_SYSTEM].at);
		expect(pressGalaxyMap(s, 'galmap').close).toBe(true);
		expect(pressGalaxyMap(s, 'uiBack').close).toBe(true);
		expect(pressGalaxyMap(s, 'sysmap').close).toBeUndefined();
	});

	it('draws a grid round the focus and the jump range round the ship', () => {
		const s = initialGalaxyMap();
		expect(gridPaths(s).length).toBeGreaterThan(10);
		expect(rangePath(s)).toMatch(/^M/);
	});
});
