import { describe, expect, it } from 'vitest';
import { nextPixelRatio, RESOLUTION } from './resolution.ts';

describe('adaptive resolution', () => {
	it('keeps the cap while frames are quick or middling', () => {
		expect(nextPixelRatio(1.5, 1.5, 16.7)).toBe(1.5);
		expect(nextPixelRatio(1.5, 1.5, 30)).toBe(1.5);
		expect(nextPixelRatio(0.8, 1.5, 30)).toBe(0.8);
	});

	it('steps down while slow, never below the floor', () => {
		let r = 1;
		for (let i = 0; i < 10; i++) r = nextPixelRatio(r, 1, 250);
		expect(r).toBe(RESOLUTION.min);
		expect(nextPixelRatio(1, 1, 60)).toBeLessThan(1);
	});

	it('steps back up with headroom, never past the cap', () => {
		let r: number = RESOLUTION.min;
		for (let i = 0; i < 10; i++) r = nextPixelRatio(r, 1.5, 12);
		expect(r).toBe(1.5);
	});
});
