import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { buildLantern, makeShipMaterials } from './three/lantern.ts';
import { readPalette } from './three/palette.ts';
import { checkParts, PART_NAMES, SHIP_ROOT, type NamedNode } from './parts.ts';

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

	it('reports a missing part and a part under the wrong parent', () => {
		const node = (name: string, parent: NamedNode | null): NamedNode => ({
			name,
			parent,
			getObjectByName: () => undefined
		});
		const root = node(SHIP_ROOT, null);
		const hull = node('hull', root);
		const ring = node('ringL', root);
		const misplaced = node('turretL', root);
		root.getObjectByName = (n) => ({ hull, ringL: ring, turretL: misplaced })[n];
		const problems = checkParts(root);
		expect(problems).toContain('Missing ringR');
		expect(problems).toContain('turretL is under lantern, not ringL');
	});
});
