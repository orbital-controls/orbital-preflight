import { describe, expect, it } from 'vitest';
import { HOME, NO_DRIVE, SYSTEMS } from './galaxy.ts';
import {
	arrival,
	arriveIn,
	bodiesOf,
	bodyIn,
	cursorBody,
	dropAt,
	layout,
	NEAR_LS,
	pickBody,
	selectBody,
	setView,
	starOf,
	steerFlat,
	steerSystem,
	systemHome,
	systemSelect,
	targetBody,
	tickSystem,
	toggleSystemMap,
	toScreen,
	toTarget,
	type SystemMapState
} from './system.ts';

const planet = () => bodiesOf(HOME).find((b) => b.kind === 'planet')!;

function cruise(s: SystemMapState, ticks: number) {
	let msg: string | undefined;
	for (let i = 0; i < ticks; i++) {
		const step = tickSystem(s, true, 1, 0.05);
		s = step.s;
		msg = step.msg ?? msg;
	}
	return { s, msg };
}

describe('a system', () => {
	it('is the same every visit, with unique ids, the star first', () => {
		for (const sys of SYSTEMS) {
			const bodies = bodiesOf(sys.id);
			expect(bodies[0].kind).toBe('star');
			expect(bodies[0].name).toBe(sys.name);
			expect(new Set(bodies.map((b) => b.id)).size).toBe(bodies.length);
			for (const b of bodies.slice(1)) expect(bodyIn(sys.id, b.parent)).toBeDefined();
		}
		expect(bodiesOf(HOME)).toBe(bodiesOf(HOME));
	});

	it('has planets in order outwards, with moons named after them', () => {
		const planets = bodiesOf(HOME).filter((b) => b.kind === 'planet');
		expect(planets.length).toBeGreaterThanOrEqual(3);
		for (let i = 1; i < planets.length; i++)
			expect(planets[i].orbit).toBeGreaterThan(planets[i - 1].orbit);
		for (const moon of bodiesOf(HOME).filter((b) => b.kind === 'moon'))
			expect(moon.name.startsWith(bodyIn(HOME, moon.parent)!.name + ' ')).toBe(true);
	});

	it('never makes a gas giant or a thick atmosphere landable', () => {
		for (const sys of SYSTEMS)
			for (const b of bodiesOf(sys.id))
				if (b.type.endsWith('gas giant') || b.type === 'Earth-like world')
					expect(b.landable).toBe(false);
	});

	it('has stations only where people live', () => {
		for (const sys of SYSTEMS) {
			const stations = bodiesOf(sys.id).filter((b) => b.kind === 'station');
			if (!sys.population) expect(stations).toHaveLength(0);
		}
		expect(SYSTEMS.some((s) => bodiesOf(s.id).some((b) => b.kind === 'station'))).toBe(true);
	});
});

describe('Map mode', () => {
	it('puts the star on the left, the row by distance, moons below what they orbit', () => {
		const placed = layout(HOME);
		expect(placed[0]).toMatchObject({ x: 0, y: 0 });
		const row = placed.filter((p) => p.y === 0 && p.body.kind !== 'star');
		for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThan(row[i - 1].x);
		for (const p of placed.filter((v) => v.body.kind === 'moon')) {
			const parent = placed.find((v) => v.body.id === p.body.parent)!;
			expect(p.x).toBe(parent.x);
			expect(p.y).toBeGreaterThan(parent.y);
		}
		expect(placed).toHaveLength(bodiesOf(HOME).length);
	});

	it('moves up on forward, sideways on x, and zooms; pitch and yaw do nothing', () => {
		const s = arriveIn(HOME);
		const up = steerFlat(HOME, s.flat, { ...NO_DRIVE, y: 1 }, 0.5);
		expect(up.y).toBeLessThan(s.flat.y);
		expect(steerFlat(HOME, s.flat, { ...NO_DRIVE, x: 1 }, 0.5).x).toBeGreaterThan(s.flat.x);
		expect(steerFlat(HOME, s.flat, { ...NO_DRIVE, zoom: 1 }, 0.5).zoom).toBeGreaterThan(1);
		expect(steerFlat(HOME, s.flat, { ...NO_DRIVE, pitch: 1, yaw: 1 }, 0.5)).toBe(s.flat);
	});

	it('picks the body drawn under a point', () => {
		const s = arriveIn(HOME);
		const p = layout(HOME).find((v) => v.body.id === planet().id)!;
		const at = toScreen(s.flat, p.x, p.y);
		expect(pickBody(s, at.x, at.y)).toBe(planet().id);
		expect(cursorBody(s)).toBe(starOf(HOME).id);
		expect(pickBody(s, -500, -500)).toBeNull();
	});
});

describe('Orrery mode', () => {
	it('steers the 3D camera, and centres on the selected body', () => {
		let s = setView(selectBody(arriveIn(HOME), planet().id), 'orrery');
		expect(s.cam.focus).not.toEqual([0, 0, 0]);
		expect(cursorBody(s)).toBe(planet().id);
		const turned = steerSystem(s, { ...NO_DRIVE, yaw: 1 }, 0.5);
		expect(turned.cam.yaw).not.toBe(s.cam.yaw);
		s = systemHome(s);
		expect(s.cam.focus).toEqual([0, 0, 0]);
	});
});

describe('selecting and targeting', () => {
	it('selects under the cursor, then targets on a second select', () => {
		let s = toggleSystemMap(arriveIn(HOME), true);
		s = { ...s, flat: { ...s.flat, ...layout(HOME).find((v) => v.body.id === planet().id)! } };
		s = { ...s, flat: { x: s.flat.x, y: s.flat.y, zoom: 1 } };
		const one = systemSelect(s);
		expect(one.s.selected).toBe(planet().id);
		const two = systemSelect(one.s);
		expect(two.s.target).toBe(planet().id);
		expect(two.msg).toBe(`${planet().name} targeted`);
	});

	it("won't target where the ship is", () => {
		const s = selectBody(arriveIn(HOME), starOf(HOME).id);
		expect(targetBody(s).msg).toBe('You are here');
	});
});

describe('supercruise', () => {
	it('closes on the target only in supercruise with throttle up', () => {
		const s = targetBody(arriveIn(HOME), planet().id).s;
		expect(tickSystem(s, false, 1, 0.05).s).toBe(s);
		expect(tickSystem(s, true, 0, 0.05).s).toBe(s);
		const { s: near, msg } = cruise(s, 400);
		expect(toTarget(near)).toBeLessThanOrEqual(NEAR_LS);
		expect(msg).toBe(`Approaching ${planet().name} · drop when ready`);
		expect(toTarget(cruise(s, 20).s)!).toBeLessThan(arrival(planet()));
	});

	it('drops at the target when near, and not before', () => {
		const s = targetBody(arriveIn(HOME), planet().id).s;
		expect(dropAt(s)).toBeNull();
		const drop = dropAt(cruise(s, 400).s)!;
		expect(drop.s.at).toBe(planet().id);
		expect(drop.s.target).toBeNull();
		expect(drop.msg).toBe(`Dropped at ${planet().name}`);
	});

	it('starts over at the star in a new system', () => {
		const other = SYSTEMS[1].id;
		const s = arriveIn(other, targetBody(arriveIn(HOME), planet().id).s);
		expect(s).toMatchObject({ system: other, target: null, at: starOf(other).id, ship: [0, 0] });
	});
});
