import { describe, expect, it } from 'vitest';
import {
	bobAmplitude,
	emitterFlash,
	FOOT_ANIM,
	gaitFor,
	indexPose,
	recoilFlex,
	reloadPose,
	segmentStates,
	slideOffset,
	tracerPose
} from './foot.ts';
import { SLIDE_TRAVEL } from './tracer.ts';

const NEVER = Number.POSITIVE_INFINITY;

describe('the Tracer slide', () => {
	it('kicks back 1.8 cm on fire and returns', () => {
		expect(slideOffset(NEVER, 6, null)).toBe(0);
		expect(slideOffset(FOOT_ANIM.fire.kick, 5, null)).toBeCloseTo(SLIDE_TRAVEL);
		expect(slideOffset(1, 5, null)).toBe(0);
	});

	it('locks back when empty and returns during reload-in', () => {
		expect(slideOffset(NEVER, 0, null)).toBe(SLIDE_TRAVEL);
		expect(slideOffset(NEVER, 0, { p: 0.5, fromEmpty: true })).toBe(SLIDE_TRAVEL);
		expect(slideOffset(NEVER, 0, { p: 0.9, fromEmpty: true })).toBe(0);
		// A reload with rounds left never moved the slide.
		expect(slideOffset(NEVER, 3, { p: 0.5, fromEmpty: false })).toBe(0);
	});
});

describe('the ammo stripe', () => {
	it('lights one segment per round, spent ones grey from the front', () => {
		expect(segmentStates(6, null)).toEqual([true, true, true, true, true, true]);
		expect(segmentStates(4, null)).toEqual([true, true, true, true, false, false]);
		expect(segmentStates(0, null).some(Boolean)).toBe(false);
	});

	it('refills left to right during reload-in', () => {
		const at = (p: number) => segmentStates(2, { p, fromEmpty: false }).filter(Boolean).length;
		expect(at(0.5)).toBe(2);
		const [a, b] = FOOT_ANIM.reload.refill;
		expect(at(a + (b - a) / 2)).toBeGreaterThan(2);
		expect(at(b)).toBe(6);
		// Lit segments are always a run from the rear.
		const mid = segmentStates(2, { p: (a + b) / 2, fromEmpty: false });
		expect(mid.indexOf(false)).toBe(mid.filter(Boolean).length);
	});
});

describe('the wrist and forearm', () => {
	it('lifts the muzzle about 7° after a shot, then settles', () => {
		expect(recoilFlex(NEVER)).toBe(0);
		expect(recoilFlex(FOOT_ANIM.fire.recoilPeak)).toBeCloseTo((7 * Math.PI) / 180);
		expect(recoilFlex(2)).toBe(0);
	});

	it('rolls the forearm about 40° inward mid-reload and back at the end', () => {
		expect(reloadPose(0).roll).toBeCloseTo(0);
		const mid = reloadPose(0.5);
		expect(mid.roll).toBeCloseTo((-40 * Math.PI) / 180);
		expect(mid.lift.some((v) => v !== 0)).toBe(true);
		expect(reloadPose(1).roll).toBeCloseTo(0);
	});

	it('drops the spent cartridge, then raises the hologram with a scan line', () => {
		const out = reloadPose(0.4);
		expect(out.cartridge.drop).toBeGreaterThan(0);
		expect(out.holo.visible).toBe(false);
		const into = reloadPose(0.6);
		expect(into.cartridge.visible).toBe(false);
		expect(into.holo.visible).toBe(true);
		expect(into.holo.scan).toBe(1);
		expect(reloadPose(0.79).holo.below).toBeLessThan(into.holo.below);
	});
});

describe('the index finger and the flash', () => {
	it('moves onto the trigger for a shot and back', () => {
		expect(indexPose(NEVER)).toBe(0);
		expect(indexPose(0.1)).toBe(1);
		expect(indexPose(2)).toBe(0);
	});

	it('flashes the emitter, softer with reduced motion', () => {
		expect(emitterFlash(0)).toBe(1);
		expect(emitterFlash(0, true)).toBeLessThan(0.5);
		expect(emitterFlash(1)).toBe(0);
	});

	it('keeps the finger off the trigger while reloading', () => {
		const pose = tracerPose({
			sinceFire: 0.1,
			ammo: 0,
			reload: { p: 0.3, fromEmpty: true },
			reducedMotion: false
		});
		expect(pose.index).toBe(0);
		expect(pose.slide).toBe(SLIDE_TRAVEL);
	});
});

describe('weapon bob', () => {
	it('grows from breathing to walking to sprinting, and stops with reduced motion', () => {
		expect(bobAmplitude('idle', false)).toBeLessThan(bobAmplitude('walk', false));
		expect(bobAmplitude('walk', false)).toBeLessThan(bobAmplitude('sprint', false));
		expect(bobAmplitude('sprint', true)).toBe(0);
		expect(gaitFor(0, true)).toBe('idle');
		expect(gaitFor(3, false)).toBe('walk');
		expect(gaitFor(6, true)).toBe('sprint');
	});
});
