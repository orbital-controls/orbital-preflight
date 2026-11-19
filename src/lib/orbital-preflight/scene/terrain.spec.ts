import { describe, expect, it } from 'vitest';
import {
	baseHeight,
	featureIn,
	groundHeight,
	hash,
	heightAt,
	onRamp,
	rampsNear,
	rockIn,
	rocksNear,
	SPAWN_CLEAR,
	type Ramp
} from './terrain.ts';

describe('the stand-in moon surface', () => {
	it('is deterministic', () => {
		expect(hash(3, -4, 1)).toBe(hash(3, -4, 1));
		expect(heightAt(123.4, -56.7)).toBe(heightAt(123.4, -56.7));
	});

	it('starts on a near-flat patch', () => {
		for (const [x, z] of [
			[0, 0],
			[2, -3],
			[-3, 2]
		])
			expect(Math.abs(heightAt(x, z))).toBeLessThan(0.15);
		expect(rocksNear(0, 0, SPAWN_CLEAR - 3)).toEqual([]);
	});

	it('has a ramp straight ahead of the start that rises toward -Z and then drops', () => {
		const ramp = featureIn(0, -1) as Ramp;
		expect(ramp.kind).toBe('ramp');
		expect(rampsNear(0, 0, 60)).toContainEqual(ramp);
		const low = heightAt(ramp.x, ramp.z + ramp.length / 2 - 0.2);
		const high = heightAt(ramp.x, ramp.z - ramp.length / 2 + 0.2);
		expect(high - low).toBeGreaterThan(ramp.height * 0.8);
		expect(heightAt(ramp.x, ramp.z - ramp.length / 2 - 0.3)).toBeLessThan(high - 1);
		expect(onRamp(ramp, ramp.x + ramp.width, ramp.z)).toBeNull();
	});

	it('rocks are bumps the wheels feel, and sit where their meshes go', () => {
		const rocks = rocksNear(60, 60, 60);
		expect(rocks.length).toBeGreaterThan(10);
		for (const rock of rocks.slice(0, 5)) {
			expect(heightAt(rock.x, rock.z) - groundHeight(rock.x, rock.z)).toBeCloseTo(rock.h, 5);
			expect(rock.r).toBeGreaterThan(0.2);
			expect(rock.r).toBeLessThanOrEqual(1);
		}
		expect(rockIn(0, 0)).toBeNull();
	});

	it('rolls gently: no cliffs in the open ground', () => {
		let worst = 0;
		for (let x = -100; x < 100; x += 1.7) {
			const a = baseHeight(x, 40);
			const b = baseHeight(x + 1, 40);
			worst = Math.max(worst, Math.abs(a - b));
		}
		expect(worst).toBeLessThan(0.25);
	});
});
