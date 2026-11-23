import { describe, expect, it } from 'vitest';
import {
	BODIES,
	bodyAt,
	HOME_BODY,
	initialSystemMap,
	orbitPath,
	pressSystemMap
} from './system-map.ts';
import { stepCamera } from './map-camera.ts';
import { SYSTEM_LIMITS } from './system-map.ts';

describe('system map', () => {
	it('opens on the body the ship is at, with nothing targeted', () => {
		const s = initialSystemMap();
		expect(s.sel).toBe(HOME_BODY);
		expect(s.target).toBeNull();
		expect(s.focus).toEqual(bodyAt(HOME_BODY));
	});

	it('Menu left and right step through the bodies, round the ends', () => {
		const s = initialSystemMap();
		expect(pressSystemMap(s, 'uiRight').map.sel).toBe(HOME_BODY + 1);
		expect(pressSystemMap({ ...s, sel: 0 }, 'uiLeft').map.sel).toBe(BODIES.length - 1);
	});

	it('Menu select targets the selected body and brings the camera to it; Map home comes back', () => {
		const picked = pressSystemMap({ ...initialSystemMap(), sel: 5 }, 'uiSelect');
		expect(picked.map.target).toBe(5);
		expect(picked.msg).toBe(`${BODIES[5].name} targeted`);
		let s = picked.map;
		for (let i = 0; i < 60; i++) s = stepCamera(s, {}, SYSTEM_LIMITS);
		expect(s.focus).toEqual(bodyAt(5));
		const home = pressSystemMap(s, 'mapHome').map;
		expect(home.sel).toBe(HOME_BODY);
		expect(home.glide).toEqual(bodyAt(HOME_BODY));
		expect(home.target).toBe(5);
	});

	it('System map and Menu back close it; the galaxy map’s bind does nothing here', () => {
		expect(pressSystemMap(initialSystemMap(), 'sysmap').close).toBe(true);
		expect(pressSystemMap(initialSystemMap(), 'uiBack').close).toBe(true);
		expect(pressSystemMap(initialSystemMap(), 'galmap').close).toBeUndefined();
	});

	it('every orbit draws, and moons orbit their planet', () => {
		const s = initialSystemMap();
		expect(orbitPath(s, 0)).toBe('');
		for (let i = 1; i < BODIES.length; i++) expect(orbitPath(s, i)).toMatch(/^M/);
		const moon = BODIES.findIndex((b) => b.parent === HOME_BODY);
		const m = bodyAt(moon);
		const h = bodyAt(HOME_BODY);
		expect(Math.hypot(m.x - h.x, m.z - h.z)).toBeCloseTo(BODIES[moon].orbit);
	});
});
