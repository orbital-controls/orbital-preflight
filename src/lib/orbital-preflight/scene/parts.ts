/**
 * The part contracts for the 3D models: Lantern II (ship) and Wick LR (SRV). The
 * animation finds every moving part by name, so a glTF exported from Blender can replace
 * a procedural model as long as it keeps these names, parents and pivots. See README.md
 * in this folder.
 *
 * Both are in three.js space: +Y up, -Z forward (the nose), +X to starboard. Lantern II
 * is 1 unit = 10 px of its 2D sheet; Wick LR is in metres.
 */

export interface PartSpec {
	name: string;
	/** The node this one must sit under. */
	parent: string;
	/** Where its origin is, and what the animation does to it. */
	pivot: string;
	/** `userData` keys the animation reads (numbers). */
	needs?: readonly string[];
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
	{
		name: 'turretL',
		parent: 'ringL',
		pivot: 'Stowed in the ring front. Slides along -Z.',
		needs: ['stowedZ']
	},
	{
		name: 'turretR',
		parent: 'ringR',
		pivot: 'Stowed in the ring front. Slides along -Z.',
		needs: ['stowedZ']
	},
	{ name: 'tailBlock', parent: SHIP_ROOT, pivot: 'Static.' },
	{
		name: 'rampDoor',
		parent: 'tailBlock',
		pivot: 'Bottom edge of the ramp. Rotates about X, top swinging aft and down.'
	},
	{
		name: 'bayDoorL',
		parent: SHIP_ROOT,
		needs: ['openSign'],
		pivot: 'Outer (port) edge on the roof. Rotates about Z, opening up and out.'
	},
	{
		name: 'bayDoorR',
		parent: SHIP_ROOT,
		needs: ['openSign'],
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
			needs: ['openSign'],
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
	userData?: Record<string, unknown>;
	getObjectByName(name: string): NamedNode | undefined;
}

/** The Wick LR (SRV) part contract. See README.md. */
export const WICK_ROOT = 'wick';

const WHEEL_IDS = ['FL', 'FR', 'RL', 'RR'] as const;

export const WICK_PARTS: readonly PartSpec[] = [
	{ name: 'body', parent: WICK_ROOT, pivot: 'Static. Flat-shaded; the facets are the look.' },
	{ name: 'stripe', parent: WICK_ROOT, pivot: 'Static. The violet waist stripe.' },
	{
		name: 'cabinGlass',
		parent: WICK_ROOT,
		pivot: "Static. Dark tinted. Hidden from the driver's seat."
	},
	{
		name: 'lightStrip',
		parent: WICK_ROOT,
		pivot: 'Static. Gold emissive, brighter with headlights.'
	},
	{ name: 'seatL', parent: WICK_ROOT, pivot: 'Static. The driver seat.' },
	{ name: 'seatR', parent: WICK_ROOT, pivot: 'Static.' },
	{ name: 'jumpSeat', parent: WICK_ROOT, pivot: 'Static.' },
	{ name: 'dash', parent: WICK_ROOT, pivot: 'Static.' },
	{
		name: 'screenDrive',
		parent: 'dash',
		pivot: 'Static. Canvas texture: speed, gear, drive assist.'
	},
	{ name: 'screenRecall', parent: 'dash', pivot: 'Static. Canvas texture: the ship.' },
	{ name: 'screenRange', parent: 'dash', pivot: 'Static. Canvas texture: fuel and spare cell.' },
	{ name: 'rack', parent: WICK_ROOT, pivot: 'Static.' },
	{ name: 'spareCell', parent: WICK_ROOT, pivot: 'Static.' },
	{ name: 'cellSeam', parent: 'spareCell', pivot: 'Static. Gold; pulses on low fuel.' },
	...WHEEL_IDS.flatMap((w) => [
		{
			name: `wheel${w}`,
			parent: WICK_ROOT,
			needs: ['restY', 'side'],
			pivot:
				'Wheel centre, axle along X. position.y = restY + travel; rotation (order YXZ): y steers (front only), x rolls.'
		},
		{ name: `wheelGlow${w}`, parent: `wheel${w}`, pivot: 'Static in the wheel. Gold glow ring.' },
		{
			name: `armUpper${w}`,
			parent: WICK_ROOT,
			needs: ['side', 'length'],
			pivot: 'Inner (chassis) end. Rotates about Z so the outer end follows the wheel.'
		},
		{
			name: `armLower${w}`,
			parent: WICK_ROOT,
			needs: ['side', 'length'],
			pivot: 'Inner (chassis) end. Rotates about Z so the outer end follows the wheel.'
		},
		{
			name: `damper${w}`,
			parent: WICK_ROOT,
			needs: ['restLength'],
			pivot: 'Upper mount, pointing down (-Y). Aims at the lower arm’s outer end and stretches.'
		},
		{
			name: `fender${w}`,
			parent: WICK_ROOT,
			needs: ['restY'],
			pivot: 'Static shape. position.y = restY + the wheel’s travel; it does not steer.'
		}
	]),
	{ name: 'noseLampL', parent: WICK_ROOT, pivot: 'Facing -Z. Gold; the headlight hangs off it.' },
	{ name: 'noseLampR', parent: WICK_ROOT, pivot: 'Facing -Z. Gold; the headlight hangs off it.' },
	{ name: 'tailLight', parent: WICK_ROOT, pivot: 'Static. Gold; brighter on brake and reverse.' },
	{ name: 'hatch', parent: WICK_ROOT, pivot: 'Top edge (a hinge for later). Static for now.' },
	{ name: 'winch', parent: WICK_ROOT, pivot: 'Drum axis, along X. Static for now.' },
	{ name: 'winchHook', parent: 'winch', pivot: 'Top of the line, under the drum.' },
	{
		name: 'turretRing',
		parent: WICK_ROOT,
		pivot: 'Static collar on the deck. Violet; brightens when the turret is up.'
	},
	{
		name: 'turret',
		parent: WICK_ROOT,
		needs: ['restY', 'lift'],
		pivot: 'Base centre on the deck. position.y = restY + lift × the rise.'
	},
	{
		name: 'turretHead',
		parent: 'turret',
		pivot: 'Turret axis. rotation.y yaws (0 = forward, left positive).'
	},
	{
		name: 'turretGun',
		parent: 'turretHead',
		pivot: 'Trunnion. rotation.x pitches; the barrel runs along -Z.'
	},
	{
		name: 'turretMuzzle',
		parent: 'turretGun',
		pivot: 'Barrel tip, facing -Z. Tracers start here.'
	},
	{ name: 'jetL', parent: WICK_ROOT, pivot: 'Nozzle centre, facing +Z (aft). Violet core.' },
	{ name: 'jetR', parent: WICK_ROOT, pivot: 'Nozzle centre, facing +Z (aft). Violet core.' },
	{
		name: 'plumeL',
		parent: 'jetL',
		pivot: 'At the nozzle, along +Z. scale.z is the plume length.'
	},
	{ name: 'plumeR', parent: 'jetR', pivot: 'At the nozzle, along +Z. scale.z is the plume length.' }
];

export const WICK_PART_NAMES: readonly string[] = WICK_PARTS.map((p) => p.name);

/**
 * Contract breaches in a model: missing parts, wrong parents, missing userData. Checks
 * the Lantern II unless given another contract.
 */
export function checkParts(
	root: NamedNode,
	parts: readonly PartSpec[] = PARTS,
	rootName: string = SHIP_ROOT
): string[] {
	const problems: string[] = [];
	if (root.name !== rootName) problems.push(`The root is "${root.name}", not "${rootName}"`);
	for (const part of parts) {
		const node = root.getObjectByName(part.name);
		if (!node) {
			problems.push(`Missing ${part.name}`);
			continue;
		}
		if (node.parent?.name !== part.parent)
			problems.push(`${part.name} is under ${node.parent?.name ?? 'nothing'}, not ${part.parent}`);
		for (const key of part.needs ?? []) {
			if (typeof node.userData?.[key] !== 'number')
				problems.push(`${part.name} has no userData.${key}`);
		}
	}
	return problems;
}
