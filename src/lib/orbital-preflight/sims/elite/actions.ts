import type { Action, AnalogRole, Mode } from '../../types.ts';

/**
 * Readable names and categories for the Elite Dangerous actions people bind most.
 * Anything else falls back to a prettified id, classified by its name: `Humanoid…` is
 * on foot, `…Buggy…` is the SRV, everything else is the ship.
 *
 * UNVERIFIED: the action ids are from memory of real .binds files. An id that's wrong
 * here does no harm (the action shows under its prettified id); one that's missing from
 * a real file just isn't listed.
 */

/** `[id, name, effect?, axis?]`. Effects are the mock flight's, from the StandFly board. */
type Entry = [id: string, name: string, effect?: string, axis?: true];

const CATALOGUE: Record<Mode, Record<string, Entry[]>> = {
	ship: {
		Flight: [
			['ForwardKey', 'Throttle up', 'thrUp'],
			['BackwardKey', 'Throttle down', 'thrDn'],
			['SetSpeedZero', 'Throttle to zero', 'thrZero'],
			['YawLeftButton', 'Yaw left', 'yawL'],
			['YawRightButton', 'Yaw right', 'yawR'],
			['RollLeftButton', 'Roll left', 'rollL'],
			['RollRightButton', 'Roll right', 'rollR'],
			['UpThrustButton', 'Thrust up', 'up'],
			['DownThrustButton', 'Thrust down', 'down'],
			['UseBoostJuice', 'Boost', 'boost'],
			['LandingGearToggle', 'Landing gear', 'gear'],
			['ToggleFlightAssist', 'Flight assist off', 'fa'],
			['ThrottleAxis', 'Throttle', 'throttle', true],
			['YawAxisRaw', 'Yaw', 'yawL|yawR', true],
			['RollAxisRaw', 'Roll', 'rollL|rollR', true],
			['PitchAxisRaw', 'Pitch', undefined, true],
			['VerticalThrustRaw', 'Vertical thrust', 'down|up', true],
			['LateralThrustRaw', 'Lateral thrust', undefined, true],
			['PitchUpButton', 'Pitch up'],
			['PitchDownButton', 'Pitch down'],
			['LeftThrustButton', 'Thrust left'],
			['RightThrustButton', 'Thrust right'],
			['SetSpeed50', 'Throttle to 50%'],
			['SetSpeed100', 'Throttle to 100%'],
			['ToggleReverseThrottleInput', 'Reverse throttle']
		],
		Navigation: [
			['HyperSuperCombination', 'Frame shift drive', 'fsd'],
			['Supercruise', 'Supercruise', 'sc'],
			['GalaxyMapOpen', 'Galaxy map', 'panel'],
			['TargetNextRouteSystem', 'Target next system in route', 'route'],
			['OrbitLinesToggle', 'Orbit lines', 'orbit'],
			['Hyperspace', 'Hyperspace jump'],
			['WingNavLock', 'Wing nav lock'],
			['SystemMapOpen', 'System map', 'panel']
		],
		Combat: [
			['PrimaryFire', 'Primary fire', 'fire'],
			['SecondaryFire', 'Secondary fire', 'fire2'],
			['DeployHardpointToggle', 'Deploy hardpoints', 'hp'],
			['SelectTarget', 'Target ahead', 'tgt'],
			['CycleNextHostileTarget', 'Next hostile', 'tgt'],
			['FireChaffLauncher', 'Deploy chaff', 'chaff'],
			['CycleNextTarget', 'Next target', 'tgt'],
			['CyclePreviousTarget', 'Previous target', 'tgt'],
			['SelectHighestThreat', 'Highest threat', 'tgt'],
			['CycleNextSubsystem', 'Next subsystem'],
			['CycleFireGroupNext', 'Next fire group'],
			['CycleFireGroupPrevious', 'Previous fire group']
		],
		Systems: [
			['DeployHeatSink', 'Deploy heat sink', 'heatsink'],
			['ToggleButtonUpInput', 'Silent running', 'silent'],
			['ToggleCargoScoop', 'Cargo scoop', 'scoop'],
			['ShipSpotLightToggle', 'Ship lights', 'lights'],
			['NightVisionToggle', 'Night vision', 'nv'],
			['IncreaseSystemsPower', 'Power to systems', 'pSys'],
			['IncreaseEnginesPower', 'Power to engines', 'pEng'],
			['IncreaseWeaponsPower', 'Power to weapons', 'pWep'],
			['ResetPowerDistribution', 'Balance power', 'pBal'],
			['UseShieldCell', 'Shield cell']
		],
		Panels: [
			['FocusLeftPanel', 'Left panel', 'panel'],
			['FocusCommsPanel', 'Comms panel', 'panel'],
			['FocusRadarPanel', 'Role panel', 'panel'],
			['FocusRightPanel', 'Right panel', 'panel'],
			['HeadLookReset', 'Reset head look', 'panel']
		]
	},
	srv: {
		Driving: [
			['IncreaseSpeedButtonMax', 'Accelerate', 'drvFwd'],
			['DecreaseSpeedButtonMax', 'Reverse', 'drvRev'],
			['SteerLeftButton', 'Steer left', 'steerL'],
			['SteerRightButton', 'Steer right', 'steerR'],
			['AutoBreakBuggyButton', 'Handbrake', 'brake'],
			['VerticalThrustersButton', 'Vertical thrusters', 'jets'],
			['ToggleDriveAssist', 'Drive assist', 'da'],
			['SteeringAxis', 'Steering', 'steerL|steerR', true],
			['DriveSpeedAxis', 'Drive speed', undefined, true],
			['BuggyRollLeftButton', 'Roll left'],
			['BuggyRollRightButton', 'Roll right'],
			['BuggyPitchUpButton', 'Pitch up'],
			['BuggyPitchDownButton', 'Pitch down']
		],
		Turret: [
			['ToggleBuggyTurretButton', 'Turret mode', 'turret'],
			['BuggyPrimaryFireButton', 'Primary fire', 'tFire'],
			['BuggySecondaryFireButton', 'Secondary fire', 'tFire2'],
			['SelectTarget_Buggy', 'Target ahead', 'tgt'],
			['BuggyTurretYawLeftButton', 'Turret left'],
			['BuggyTurretYawRightButton', 'Turret right'],
			['BuggyTurretPitchUpButton', 'Turret up'],
			['BuggyTurretPitchDownButton', 'Turret down']
		],
		Systems: [
			['HeadlightsBuggyButton', 'Headlights', 'sLights'],
			['ToggleCargoScoop_Buggy', 'Cargo scoop', 'sScoop'],
			['RecallDismissShip', 'Recall / dismiss ship', 'recall'],
			['IncreaseSystemsPower_Buggy', 'Power to systems', 'pSys'],
			['IncreaseEnginesPower_Buggy', 'Power to engines', 'pEng'],
			['IncreaseWeaponsPower_Buggy', 'Power to weapons', 'pWep'],
			['ResetPowerDistribution_Buggy', 'Balance power', 'pBal']
		],
		Panels: [
			['FocusLeftPanel_Buggy', 'Left panel', 'panel'],
			['FocusCommsPanel_Buggy', 'Comms panel', 'panel'],
			['FocusRadarPanel_Buggy', 'Role panel', 'panel'],
			['FocusRightPanel_Buggy', 'Right panel', 'panel'],
			['GalaxyMapOpen_Buggy', 'Galaxy map', 'panel']
		]
	},
	foot: {
		Moving: [
			['HumanoidForwardButton', 'Move forward', 'walkF'],
			['HumanoidBackwardButton', 'Move back', 'walkB'],
			['HumanoidStrafeLeftButton', 'Strafe left', 'walkL'],
			['HumanoidStrafeRightButton', 'Strafe right', 'walkR'],
			['HumanoidSprintButton', 'Sprint', 'sprint'],
			['HumanoidJumpButton', 'Jump', 'jump'],
			['HumanoidCrouchButton', 'Crouch', 'crouch'],
			// UNVERIFIED ids: Odyssey's on-foot axes, as remembered.
			['HumanoidForwardAxis', 'Move forward / back', undefined, true],
			['HumanoidStrafeAxis', 'Strafe', undefined, true],
			['HumanoidRotateAxis', 'Look left / right', undefined, true],
			['HumanoidPitchAxis', 'Look up / down', undefined, true]
		],
		Combat: [
			['HumanoidPrimaryFireButton', 'Fire weapon', 'primary'],
			['HumanoidZoomButton', 'Aim down sights', 'aim'],
			['HumanoidReloadButton', 'Reload', 'reload'],
			['HumanoidMeleeButton', 'Melee', 'melee'],
			['HumanoidThrowGrenadeButton', 'Throw grenade', 'grenade'],
			['HumanoidSelectNextWeaponButton', 'Next weapon', 'wNext'],
			['HumanoidSelectPreviousWeaponButton', 'Previous weapon', 'wPrev'],
			['HumanoidHolsterWeaponButton', 'Holster weapon', 'holster'],
			['HumanoidSelectPrimaryWeaponButton', 'Primary weapon'],
			['HumanoidSelectSecondaryWeaponButton', 'Secondary weapon']
		],
		Tools: [
			['HumanoidPrimaryInteractButton', 'Interact', 'interact'],
			['HumanoidHealthPack', 'Use medkit', 'medkit'],
			['HumanoidBattery', 'Use energy cell', 'cell'],
			['HumanoidToggleFlashlightButton', 'Flashlight', 'flash'],
			['HumanoidToggleNightVisionButton', 'Night vision', 'fNv'],
			['HumanoidToggleShieldsButton', 'Toggle suit shield']
		],
		Panels: [
			['HumanoidEmoteWheelButton', 'Emote wheel', 'panel'],
			['HumanoidItemWheelButton', 'Item wheel', 'panel'],
			['GalaxyMapOpen_Humanoid', 'Galaxy map', 'panel']
		]
	}
};

/** The axes the 3D scene flies and drives by. */
const ANALOG: Record<string, AnalogRole> = {
	ThrottleAxis: 'throttle',
	PitchAxisRaw: 'pitch',
	RollAxisRaw: 'roll',
	YawAxisRaw: 'yaw',
	SteeringAxis: 'steer',
	DriveSpeedAxis: 'drive',
	HumanoidForwardAxis: 'moveY',
	HumanoidStrafeAxis: 'moveX',
	HumanoidRotateAxis: 'lookX',
	HumanoidPitchAxis: 'lookY'
};

interface Known {
	name: string;
	category: string;
	mode: Mode;
	axis: boolean;
	effect?: string;
	order: number;
}

const KNOWN = new Map<string, Known>();
let order = 0;
for (const [mode, categories] of Object.entries(CATALOGUE) as [Mode, Record<string, Entry[]>][]) {
	for (const [category, entries] of Object.entries(categories)) {
		for (const [id, name, effect, axis] of entries) {
			KNOWN.set(id, { name, category, mode, axis: Boolean(axis), effect, order: order++ });
		}
	}
}

/** Categories per mode, in the boards' order. Actions we don't know go under "Other". */
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

/** ED contexts that read keys apart from flight. UNVERIFIED prefixes. */
function contextOf(id: string): string | undefined {
	if (/^UI_|^CycleNextPanel|^CyclePreviousPanel|^CyclePreviousPage|^CycleNextPage/.test(id))
		return 'menus';
	if (/^Cam|^ToggleFreeCam|^FreeCam|^VanityCamera|^PhotoCamera/.test(id)) return 'camera';
	if (/^(Explorer|FSS|Saa|ExplorationFSS|ExplorationSAA)/.test(id)) return 'scanner';
	if (/^(Store|Galnet|Multicrew|Commander)/.test(id)) return 'panels';
	return undefined;
}

export function describeAction(id: string, axisInFile: boolean): Action {
	const context = contextOf(id);
	const known = KNOWN.get(id);
	if (known) {
		return {
			id,
			name: known.name,
			category: known.category,
			mode: known.mode,
			...(known.axis && { axis: true }),
			...(known.effect && { effect: known.effect }),
			...(ANALOG[id] && { analog: ANALOG[id] }),
			...(context && { context })
		};
	}
	return {
		id,
		name: prettify(id),
		category: 'Other',
		mode: classifyMode(id),
		...(axisInFile && { axis: true }),
		...(context && { context })
	};
}

/** Known actions first in catalogue order, then the rest by name. */
export function compareActions(a: Action, b: Action): number {
	const ka = KNOWN.get(a.id)?.order ?? Infinity;
	const kb = KNOWN.get(b.id)?.order ?? Infinity;
	if (ka !== kb) return ka - kb;
	return a.name.localeCompare(b.name);
}
