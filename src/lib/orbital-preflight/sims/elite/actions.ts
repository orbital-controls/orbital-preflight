import type { Action, Mode } from '../../types.ts';

/**
 * Readable names and categories for the Elite Dangerous actions people bind most.
 * Anything else falls back to a prettified id, classified by its name: `Humanoid…` is
 * on foot, `…Buggy…` is the SRV, everything else is the ship.
 *
 * UNVERIFIED: the action ids are from memory of real .binds files. An id that's wrong
 * here does no harm (the action shows under its prettified id); one that's missing from
 * a real file just isn't listed.
 */

type Entry = [id: string, name: string, axis?: true];

const CATALOGUE: Record<Mode, Record<string, Entry[]>> = {
	ship: {
		Flight: [
			['PitchAxisRaw', 'Pitch', true],
			['RollAxisRaw', 'Roll', true],
			['YawAxisRaw', 'Yaw', true],
			['LateralThrustRaw', 'Lateral thrust', true],
			['VerticalThrustRaw', 'Vertical thrust', true],
			['PitchUpButton', 'Pitch up'],
			['PitchDownButton', 'Pitch down'],
			['RollLeftButton', 'Roll left'],
			['RollRightButton', 'Roll right'],
			['YawLeftButton', 'Yaw left'],
			['YawRightButton', 'Yaw right'],
			['LeftThrustButton', 'Thrust left'],
			['RightThrustButton', 'Thrust right'],
			['UpThrustButton', 'Thrust up'],
			['DownThrustButton', 'Thrust down'],
			['ToggleFlightAssist', 'Flight assist'],
			['UseBoostJuice', 'Boost']
		],
		Throttle: [
			['ThrottleAxis', 'Throttle', true],
			['ForwardKey', 'Throttle up'],
			['BackwardKey', 'Throttle down'],
			['SetSpeedZero', 'Throttle 0%'],
			['SetSpeed50', 'Throttle 50%'],
			['SetSpeed100', 'Throttle 100%'],
			['ToggleReverseThrottleInput', 'Reverse throttle']
		],
		Weapons: [
			['PrimaryFire', 'Primary fire'],
			['SecondaryFire', 'Secondary fire'],
			['DeployHardpointToggle', 'Hardpoints'],
			['CycleFireGroupNext', 'Next fire group'],
			['CycleFireGroupPrevious', 'Previous fire group']
		],
		Targeting: [
			['SelectTarget', 'Target ahead'],
			['CycleNextTarget', 'Next target'],
			['CyclePreviousTarget', 'Previous target'],
			['SelectHighestThreat', 'Highest threat'],
			['CycleNextSubsystem', 'Next subsystem']
		],
		Systems: [
			['LandingGearToggle', 'Landing gear'],
			['ShipSpotLightToggle', 'Ship lights'],
			['ToggleCargoScoop', 'Cargo scoop'],
			['NightVisionToggle', 'Night vision'],
			['ToggleButtonUpInput', 'Silent running'],
			['DeployHeatSink', 'Heat sink'],
			['FireChaffLauncher', 'Chaff'],
			['UseShieldCell', 'Shield cell']
		],
		Power: [
			['IncreaseSystemsPower', 'Pip to systems'],
			['IncreaseEnginesPower', 'Pip to engines'],
			['IncreaseWeaponsPower', 'Pip to weapons'],
			['ResetPowerDistribution', 'Balance power']
		],
		Navigation: [
			['Supercruise', 'Supercruise'],
			['Hyperspace', 'Hyperspace jump'],
			['HyperSuperCombination', 'Frame shift drive'],
			['TargetNextRouteSystem', 'Next system in route'],
			['GalaxyMapOpen', 'Galaxy map'],
			['SystemMapOpen', 'System map']
		]
	},
	srv: {
		Driving: [
			['SteeringAxis', 'Steering', true],
			['DriveSpeedAxis', 'Drive speed', true],
			['SteerLeftButton', 'Steer left'],
			['SteerRightButton', 'Steer right'],
			['IncreaseSpeedButtonMax', 'Accelerate'],
			['DecreaseSpeedButtonMax', 'Reverse'],
			['AutoBreakBuggyButton', 'Handbrake'],
			['ToggleDriveAssist', 'Drive assist'],
			['VerticalThrustersButton', 'Vertical thrusters'],
			['BuggyRollLeftButton', 'Roll left'],
			['BuggyRollRightButton', 'Roll right'],
			['BuggyPitchUpButton', 'Pitch up'],
			['BuggyPitchDownButton', 'Pitch down']
		],
		Turret: [
			['ToggleBuggyTurretButton', 'Turret mode'],
			['BuggyPrimaryFireButton', 'Primary fire'],
			['BuggySecondaryFireButton', 'Secondary fire'],
			['BuggyTurretYawLeftButton', 'Turret left'],
			['BuggyTurretYawRightButton', 'Turret right'],
			['BuggyTurretPitchUpButton', 'Turret up'],
			['BuggyTurretPitchDownButton', 'Turret down']
		],
		Systems: [
			['HeadlightsBuggyButton', 'Headlights'],
			['RecallDismissShip', 'Recall ship'],
			['ToggleCargoScoop_Buggy', 'Cargo scoop'],
			['IncreaseSystemsPower_Buggy', 'Pip to systems'],
			['IncreaseEnginesPower_Buggy', 'Pip to engines'],
			['IncreaseWeaponsPower_Buggy', 'Pip to weapons'],
			['ResetPowerDistribution_Buggy', 'Balance power']
		]
	},
	foot: {
		Movement: [
			['HumanoidForwardButton', 'Forward'],
			['HumanoidBackwardButton', 'Backward'],
			['HumanoidStrafeLeftButton', 'Strafe left'],
			['HumanoidStrafeRightButton', 'Strafe right'],
			['HumanoidSprintButton', 'Sprint'],
			['HumanoidCrouchButton', 'Crouch'],
			['HumanoidJumpButton', 'Jump']
		],
		Combat: [
			['HumanoidPrimaryFireButton', 'Fire'],
			['HumanoidZoomButton', 'Aim'],
			['HumanoidReloadButton', 'Reload'],
			['HumanoidHolsterWeaponButton', 'Holster'],
			['HumanoidMeleeButton', 'Melee'],
			['HumanoidThrowGrenadeButton', 'Grenade'],
			['HumanoidSelectPrimaryWeaponButton', 'Primary weapon'],
			['HumanoidSelectSecondaryWeaponButton', 'Secondary weapon']
		],
		Tools: [
			['HumanoidToggleFlashlightButton', 'Flashlight'],
			['HumanoidPrimaryInteractButton', 'Interact'],
			['HumanoidHealthPack', 'Medkit'],
			['HumanoidBattery', 'Energy cell'],
			['HumanoidToggleShieldsButton', 'Shields'],
			['HumanoidToggleNightVisionButton', 'Night vision']
		]
	}
};

interface Known {
	name: string;
	category: string;
	mode: Mode;
	axis: boolean;
	order: number;
}

const KNOWN = new Map<string, Known>();
let order = 0;
for (const [mode, categories] of Object.entries(CATALOGUE) as [Mode, Record<string, Entry[]>][]) {
	for (const [category, entries] of Object.entries(categories)) {
		for (const [id, name, axis] of entries) {
			KNOWN.set(id, { name, category, mode, axis: Boolean(axis), order: order++ });
		}
	}
}

/** Categories per mode, in panel order. Actions we don't know go under "Other". */
export const CATEGORIES: Record<Mode, string[]> = {
	ship: [...Object.keys(CATALOGUE.ship), 'Other'],
	srv: [...Object.keys(CATALOGUE.srv), 'Other'],
	foot: [...Object.keys(CATALOGUE.foot), 'Other']
};

/** SRV actions whose ids don't say "Buggy". */
const SRV_IDS = new Set(
	Object.values(CATALOGUE.srv)
		.flat()
		.map(([id]) => id)
);

export function classifyMode(id: string): Mode {
	if (KNOWN.has(id)) return KNOWN.get(id)!.mode;
	if (id.startsWith('Humanoid')) return 'foot';
	if (/Buggy/.test(id) || SRV_IDS.has(id)) return 'srv';
	return 'ship';
}

/** `HumanoidToggleShieldsButton` → "Toggle shields"; `IncreaseEnginesPower_Buggy` → "Increase engines power". */
export function prettify(id: string): string {
	const words = id
		.replace(/^Humanoid/, '')
		.replace(/_Buggy$|Buggy/g, '')
		.replace(/_/g, ' ')
		.replace(/(Button|Key)$/, '')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.trim()
		.toLowerCase();
	return words ? words[0].toUpperCase() + words.slice(1) : id;
}

export function describeAction(id: string, axisInFile: boolean): Action {
	const known = KNOWN.get(id);
	if (known) {
		return { id, name: known.name, category: known.category, mode: known.mode, ...(known.axis && { axis: true }) };
	}
	return {
		id,
		name: prettify(id),
		category: 'Other',
		mode: classifyMode(id),
		...(axisInFile && { axis: true })
	};
}

/** Known actions first in catalogue order, then the rest by name. */
export function compareActions(a: Action, b: Action): number {
	const ka = KNOWN.get(a.id)?.order ?? Infinity;
	const kb = KNOWN.get(b.id)?.order ?? Infinity;
	if (ka !== kb) return ka - kb;
	return a.name.localeCompare(b.name);
}
