import { describe, expect, it } from 'vitest';
import {
	act,
	enterMode,
	initialFlight,
	shipHud,
	statusChips,
	tick,
	type FlightState
} from './flight.ts';

const run = (s: FlightState, ...effects: string[]) => effects.reduce((st, e) => act(st, e, e), s);

describe('mock flight', () => {
	it('throttle steps by 20% within 0..100', () => {
		let s = initialFlight();
		s = run(s, 'thrUp', 'thrUp', 'thrUp', 'thrUp');
		expect(s.thr).toBe(1);
		expect(run(s, 'thrZero').thr).toBe(0);
	});

	it('lowering the gear caps the throttle at 60% and says so', () => {
		const s = run({ ...initialFlight(), thr: 1 }, 'gear');
		expect(s).toMatchObject({ gear: true, thr: 0.6, msg: 'Gear down · speed limited' });
		expect(run(s, 'gear').gear).toBe(false);
	});

	it('weapons need hardpoints deployed', () => {
		const stowed = run(initialFlight(), 'fire');
		expect(stowed).toMatchObject({ fireT: 0, msg: 'Hardpoints are stowed' });
		expect(run(initialFlight(), 'hp', 'fire').fireT).toBe(5);
	});

	it('pips move one at a time from the fullest other system', () => {
		const s = run(initialFlight(), 'pEng', 'pEng');
		expect(s.pips).toEqual([1, 4, 1]);
		expect(run(s, 'pEng').pips).toEqual([1, 4, 1]);
		expect(run(s, 'pBal').pips).toEqual([2, 2, 2]);
	});

	it('the heat sink dumps heat; silent running builds it', () => {
		let s = run(initialFlight(), 'silent');
		const before = s.heat;
		s = tick(s, 'ship');
		expect(s.heat).toBeGreaterThan(before);
		expect(run(s, 'heatsink').heat).toBe(0);
	});

	it('timers count down each tick, and mode switches clear shared effects', () => {
		let s = run(initialFlight(), 'hp', 'fire', 'tgt');
		s = tick(s, 'ship');
		expect(s.fireT).toBe(4);
		expect(enterMode(s)).toMatchObject({ fireT: 0, tgt: false, msgT: 0 });
	});

	it('the SRV turret gates its guns', () => {
		expect(run(initialFlight(), 'tFire').msg).toBe('Switch to turret mode to fire');
		expect(run(initialFlight(), 'turret', 'tFire').fireT).toBe(5);
	});

	it('on foot: fire spends ammo, reload refills after its timer', () => {
		let s = run(initialFlight(), 'primary', 'reload');
		expect(s.ammo).toBe(23);
		while (s.reloadT > 0) s = tick(s, 'foot');
		expect(s).toMatchObject({ ammo: 30, reserve: 113 });
		expect(run(s, 'holster', 'primary')).toMatchObject({ ammo: 30, msg: 'Weapon holstered' });
	});

	it('on foot: every walk direction is the board walk', () => {
		for (const e of ['walk', 'walkF', 'walkB', 'walkL', 'walkR'])
			expect(run(initialFlight(), e).walkT).toBe(8);
	});

	it('panels say they would open; unknown effects change nothing', () => {
		expect(act(initialFlight(), 'panel', 'Galaxy map').msg).toBe('Galaxy map would open');
		expect(act(initialFlight(), 'nothing', 'x')).toEqual(initialFlight());
	});

	it('HUD values and status chips read the state', () => {
		const s = run(initialFlight(), 'fa', 'gear');
		expect(shipHud(s)).toMatchObject({ thr: 40, mode: 'FA off' });
		expect(
			statusChips(s, 'ship')
				.filter((c) => c.on)
				.map((c) => c.name)
		).toEqual(['GEAR', 'LIGHTS', 'FA OFF']);
	});
});
