/**
 * The Lantern II part contract. The animation code finds every moving part by name, so
 * a glTF exported from Blender can replace the procedural mesh as long as it keeps these
 * names and pivots. See README.md in this folder.
 *
 * Frame: +Y up, -Z forward (the nose), +X to starboard. 1 unit = 10 px of the 2D sheet.
 */

export interface PartSpec {
	name: string;
	/** The node this one must sit under. */
	parent: string;
	/** Where its origin is, and what the animation does to it. */
	pivot: string;
}

export const SHIP_ROOT = 'lantern';

export const PARTS: readonly PartSpec[] = [
	{ name: 'hull', parent: SHIP_ROOT, pivot: 'Static. Ship origin.' },
	{
		name: 'stripe',
		parent: SHIP_ROOT,
		pivot: 'Static. Emissive violet, dimmed by silent running.'
	},
	{
		name: 'canopyGlass',
		parent: SHIP_ROOT,
		pivot: 'Static. Hidden in the cockpit camera, so the windshield is clear.'
	},
	{ name: 'pylonL', parent: SHIP_ROOT, pivot: 'Static.' },
	{ name: 'pylonR', parent: SHIP_ROOT, pivot: 'Static.' },
	{ name: 'ringL', parent: SHIP_ROOT, pivot: 'Ring centre. Rotates about Y with yaw.' },
	{ name: 'ringR', parent: SHIP_ROOT, pivot: 'Ring centre. Rotates about Y with yaw.' },
	{ name: 'ringGlowL', parent: 'ringL', pivot: 'Static in the ring. Gold, scaled by the glow.' },
	{ name: 'ringGlowR', parent: 'ringR', pivot: 'Static in the ring. Gold, scaled by the glow.' },
	{ name: 'turretL', parent: 'ringL', pivot: 'Stowed in the ring front. Slides along -Z.' },
	{ name: 'turretR', parent: 'ringR', pivot: 'Stowed in the ring front. Slides along -Z.' },
	{ name: 'tailBlock', parent: SHIP_ROOT, pivot: 'Static.' },
	{
		name: 'rampDoor',
		parent: 'tailBlock',
		pivot: 'Bottom edge of the ramp. Rotates about X, top swinging aft and down.'
	},
	{
		name: 'bayDoorL',
		parent: SHIP_ROOT,
		pivot: 'Outer (port) edge on the roof. Rotates about Z, opening up and out.'
	},
	{
		name: 'bayDoorR',
		parent: SHIP_ROOT,
		pivot: 'Outer (starboard) edge on the roof. Rotates about Z, opening up and out.'
	},
	...(['FL', 'FR', 'RL', 'RR'] as const).flatMap((g) => [
		{
			name: `gear${g}`,
			parent: SHIP_ROOT,
			pivot: 'Hinge under the belly. Stowed lying aft; rotates about X down to vertical.'
		},
		{
			name: `gearDoor${g}`,
			parent: SHIP_ROOT,
			pivot: 'Outer edge of the belly door. Rotates about Z, dropping outward.'
		}
	]),
	{
		name: 'noseLight',
		parent: SHIP_ROOT,
		pivot: 'Nose tip, facing -Z. Gold emissive; the floodlight hangs off it.'
	},
	{ name: 'tailLights', parent: 'tailBlock', pivot: 'Static. Amber emissive.' }
];

export const PART_NAMES: readonly string[] = PARTS.map((p) => p.name);

/** Anything with named children: a three.js Object3D, or a stub in tests. */
export interface NamedNode {
	name: string;
	parent: NamedNode | null;
	getObjectByName(name: string): NamedNode | undefined;
}

/** Contract breaches in a ship model: missing parts, or parts under the wrong parent. */
export function checkParts(root: NamedNode): string[] {
	const problems: string[] = [];
	if (root.name !== SHIP_ROOT) problems.push(`The root is "${root.name}", not "${SHIP_ROOT}"`);
	for (const part of PARTS) {
		const node = root.getObjectByName(part.name);
		if (!node) {
			problems.push(`Missing ${part.name}`);
			continue;
		}
		if (node.parent?.name !== part.parent)
			problems.push(`${part.name} is under ${node.parent?.name ?? 'nothing'}, not ${part.parent}`);
	}
	return problems;
}
