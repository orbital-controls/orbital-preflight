import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { beamStart } from './foot-scene.ts';

describe('the holo round streak', () => {
	const world = new PerspectiveCamera(70, 900 / 560, 0.05, 120);
	world.position.set(12, 1.7, -5);
	world.rotation.set(0, 0.4, 0);
	world.updateMatrixWorld();
	const overlay = new PerspectiveCamera(46, 900 / 560, 1, 600);
	overlay.position.set(-40, 10, -15);
	overlay.lookAt(30, -1, -2);
	overlay.updateMatrixWorld();

	it('starts half a metre from the eye, on the screen spot of the emitter', () => {
		const muzzle = new Vector3(9.5, 1.6, 0);
		const start = beamStart(world, overlay, muzzle, 0.5, new Vector3());
		expect(start.distanceTo(world.position)).toBeCloseTo(0.5, 5);
		// Same place on screen in both layers.
		const a = muzzle.clone().project(overlay);
		const b = start.clone().project(world);
		expect(b.x).toBeCloseTo(a.x, 4);
		expect(b.y).toBeCloseTo(a.y, 4);
	});

	it('starts low and to the right of the crosshair, where the gun is, not at the origin', () => {
		const start = beamStart(world, overlay, new Vector3(9.5, 1.6, 0), 0.5, new Vector3());
		expect(start.length()).toBeGreaterThan(5);
		const ndc = start.clone().project(world);
		expect(ndc.x).toBeGreaterThan(0);
		expect(ndc.y).toBeLessThan(0);
	});
});
