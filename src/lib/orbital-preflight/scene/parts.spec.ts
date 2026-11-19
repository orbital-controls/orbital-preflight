import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { buildLantern, makeShipMaterials } from './three/lantern.ts';
import { buildWick, makeWickMaterials } from './three/wick.ts';
import { readPalette } from './three/palette.ts';
import {
	checkParts,
	PART_NAMES,
	SHIP_ROOT,
	WICK_PART_NAMES,
	WICK_PARTS,
	WICK_ROOT,
	type NamedNode
} from './parts.ts';

describe('the Lantern II part contract', () => {
	it('the procedural ship has every named part under the right parent', () => {
		const palette = readPalette(null);
		const { root } = buildLantern(palette, makeShipMaterials(palette, new Texture()));
		expect(checkParts(root)).toEqual([]);
	});

	it('names are unique and include the parts the animation drives', () => {
		expect(new Set(PART_NAMES).size).toBe(PART_NAMES.length);
		for (const name of ['ringL', 'turretR', 'rampDoor', 'bayDoorL', 'gearRR', 'gearDoorFL']) {
			expect(PART_NAMES).toContain(name);
		}
	});

	it('reports a missing part, a wrong parent and missing userData', () => {
		const node = (name: string, parent: NamedNode | null): NamedNode => ({
			name,
			parent,
			getObjectByName: () => undefined
		});
		const root = node(SHIP_ROOT, null);
		const hull = node('hull', root);
		const ring = node('ringL', root);
		const misplaced = node('turretL', root);
		const door = node('bayDoorL', root);
		root.getObjectByName = (n) => ({ hull, ringL: ring, turretL: misplaced, bayDoorL: door })[n];
		const problems = checkParts(root);
		expect(problems).toContain('Missing ringR');
		expect(problems).toContain('turretL is under lantern, not ringL');
		expect(problems).toContain('turretL has no userData.stowedZ');
		expect(problems).toContain('bayDoorL has no userData.openSign');
	});
});

describe('the Wick LR part contract', () => {
	// The dash screens draw on canvases; a stub is enough to build the model.
	const stubCanvas = () => {
		const doc = globalThis as unknown as { document?: unknown };
		if (doc.document) return;
		doc.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
	};

	it('the procedural Wick LR has every named part under the right parent', () => {
		stubCanvas();
		const palette = readPalette(null);
		const { root } = buildWick(palette, makeWickMaterials(palette, new Texture()));
		expect(checkParts(root, WICK_PARTS, WICK_ROOT)).toEqual([]);
	});

	it('names are unique and cover the brief’s parts', () => {
		expect(new Set(WICK_PART_NAMES).size).toBe(WICK_PART_NAMES.length);
		for (const name of [
			'body',
			'stripe',
			'cabinGlass',
			'lightStrip',
			'seatL',
			'seatR',
			'jumpSeat',
			'dash',
			'rack',
			'spareCell',
			'noseLampL',
			'noseLampR',
			'tailLight',
			'hatch',
			'winch',
			'winchHook',
			'jetL',
			'jetR',
			'plumeL',
			'plumeR'
		])
			expect(WICK_PART_NAMES).toContain(name);
		for (const id of ['FL', 'FR', 'RL', 'RR'])
			for (const part of ['wheel', 'wheelGlow', 'armUpper', 'armLower', 'damper', 'fender'])
				expect(WICK_PART_NAMES).toContain(`${part}${id}`);
	});

	it('checks the Wick root by its own name', () => {
		const root: NamedNode = { name: 'lantern', parent: null, getObjectByName: () => undefined };
		const problems = checkParts(root, WICK_PARTS, WICK_ROOT);
		expect(problems[0]).toBe('The root is "lantern", not "wick"');
		expect(problems).toContain('Missing wheelFL');
	});
});
