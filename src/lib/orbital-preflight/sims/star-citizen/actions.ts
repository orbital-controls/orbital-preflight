import { bindKey } from '../../bindings.ts';
import type { Action, AnalogRole, Mode } from '../../types.ts';
import { DEFAULT_MAPS, type DefaultAction } from './defaults.ts';
import { decodeBind } from './inputs.ts';

/**
 * Star Citizen's actions, from the game's own defaultProfile.xml (`defaults.ts`, generated):
 * every action map the keybinding screen lists, each filed under a mode and a category of
 * ours. Ids are `<actionmap>.<action>`, because the game reuses action names across maps
 * (`v_yaw` steers ships and ground vehicles).
 *
 * Effects are the mock flight's (`flight.ts`), on the actions that do that job in game.
 * Star Citizen has no SRV: its ground vehicles take that tab, under the sim's own name.
 */

interface MapInfo {
	mode: Mode;
	category: string;
	/**
	 * The game reads these maps only in their own operator mode or seat, so one key can do a
	 * job in each without a clash: Mouse 1 fires guns, launches missiles, mines and spools
	 * the quantum drive. UNVERIFIED: which maps the game reads apart is from how the modes
	 * play, not from the file.
	 */
	context?: string;
}

const MAPS: Record<string, MapInfo> = {
	spaceship_movement: { mode: 'ship', category: 'Flight' },
	spaceship_quantum: { mode: 'ship', category: 'Quantum travel', context: 'quantum' },
	spaceship_docking: { mode: 'ship', category: 'Flight' },
	spaceship_weapons: { mode: 'ship', category: 'Weapons', context: 'guns' },
	spaceship_missiles: { mode: 'ship', category: 'Missiles', context: 'missiles' },
	spaceship_defensive: { mode: 'ship', category: 'Shields and countermeasures' },
	spaceship_targeting: { mode: 'ship', category: 'Targeting' },
	spaceship_targeting_advanced: { mode: 'ship', category: 'Targeting' },
	spaceship_target_hailing: { mode: 'ship', category: 'Targeting' },
	spaceship_power: { mode: 'ship', category: 'Power' },
	spaceship_radar: { mode: 'ship', category: 'Scanning' },
	spaceship_scanning: { mode: 'ship', category: 'Scanning', context: 'scanning' },
	spaceship_mining: { mode: 'ship', category: 'Mining', context: 'mining' },
	spaceship_salvage: { mode: 'ship', category: 'Salvage', context: 'salvage' },
	seat_general: { mode: 'ship', category: 'Seat and operator modes' },
	spaceship_general: { mode: 'ship', category: 'Cockpit' },
	spaceship_hud: { mode: 'ship', category: 'Cockpit' },
	lights_controller: { mode: 'ship', category: 'Cockpit' },
	spaceship_view: { mode: 'ship', category: 'View' },
	turret_movement: { mode: 'ship', category: 'Turrets', context: 'turret' },
	turret_advanced: { mode: 'ship', category: 'Turrets', context: 'turret' },
	view_director_mode: { mode: 'ship', category: 'Camera', context: 'camera' },
	player_input_optical_tracking: { mode: 'ship', category: 'Head tracking and voice' },
	vehicle_driver: { mode: 'srv', category: 'Driving' },
	vehicle_general: { mode: 'srv', category: 'Vehicle' },
	player: { mode: 'foot', category: 'On foot' },
	prone: { mode: 'foot', category: 'On foot' },
	incapacitated: { mode: 'foot', category: 'On foot' },
	tractor_beam: { mode: 'foot', category: 'Tractor beam', context: 'tractor beam' },
	zero_gravity_eva: { mode: 'foot', category: 'EVA', context: 'eva' },
	zero_gravity_traversal: { mode: 'foot', category: 'EVA', context: 'eva' },
	player_choice: { mode: 'foot', category: 'Interaction', context: 'interaction' },
	player_emotes: { mode: 'foot', category: 'Emotes' },
	default: { mode: 'foot', category: 'Social' },
	ui_notification: { mode: 'foot', category: 'Social' }
};

/** What an action does in the mock flight, by `<map>.<action>`. */
const EFFECTS: Record<string, string> = {
	// Ship. W and S step the throttle; the master mode stands in for hardpoints (guns fire
	// in SCM, not NAV); the engineering screen's three assignments stand in for the pips.
	'spaceship_movement.v_strafe_forward': 'thrUp',
	'spaceship_movement.v_strafe_back': 'thrDn',
	'spaceship_movement.v_space_brake': 'thrZero',
	'spaceship_movement.v_yaw_left': 'yawL',
	'spaceship_movement.v_yaw_right': 'yawR',
	'spaceship_movement.v_roll_left': 'rollL',
	'spaceship_movement.v_roll_right': 'rollR',
	'spaceship_movement.v_strafe_up': 'up',
	'spaceship_movement.v_strafe_down': 'down',
	'spaceship_movement.v_afterburner': 'boost',
	'spaceship_movement.v_toggle_landing_system': 'gear',
	'spaceship_movement.v_ifcs_vector_decoupling_toggle': 'fa',
	'spaceship_movement.v_master_mode_cycle': 'hp',
	'spaceship_movement.v_master_mode_cycle_long': 'hp',
	'spaceship_movement.v_yaw': 'yawL|yawR',
	'spaceship_movement.v_roll': 'rollL|rollR',
	'spaceship_movement.v_strafe_vertical': 'down|up',
	'spaceship_movement.v_strafe_longitudinal': 'throttle',
	'spaceship_quantum.v_toggle_qdrive_engagement': 'fsd',
	'seat_general.v_toggle_quantum_mode': 'sc',
	'spaceship_weapons.v_weapon_preset_attack': 'fire',
	'spaceship_missiles.v_weapon_toggle_launch_missile': 'fire2',
	'spaceship_missiles.v_weapon_launch_missile': 'fire2',
	'spaceship_targeting_advanced.v_target_under_reticle': 'tgt',
	'spaceship_targeting_advanced.v_target_cycle_in_view_fwd': 'tgt',
	'spaceship_targeting_advanced.v_target_cycle_in_view_back': 'tgt',
	'spaceship_targeting_advanced.v_target_cycle_hostile_fwd': 'tgt',
	'spaceship_targeting_advanced.v_target_cycle_hostile_back': 'tgt',
	'spaceship_targeting_advanced.v_target_cycle_all_fwd': 'tgt',
	'spaceship_targeting_advanced.v_target_cycle_all_back': 'tgt',
	'spaceship_defensive.v_weapon_countermeasure_decoy_launch': 'chaff',
	'spaceship_defensive.v_weapon_countermeasure_noise_launch': 'heatsink',
	'spaceship_power.v_engineering_assignment_shields_increase': 'pSys',
	'spaceship_power.v_engineering_assignment_engine_increase': 'pEng',
	'spaceship_power.v_engineering_assignment_weapons_increase': 'pWep',
	'spaceship_power.v_engineering_assignment_reset': 'pBal',
	'spaceship_radar.v_invoke_ping': 'ping',
	'lights_controller.v_lights': 'lights',
	'seat_general.v_light_amplification_toggle': 'nv',
	'spaceship_hud.mobiglas': 'panel',
	'spaceship_hud.v_starmap': 'panel',
	'spaceship_hud.v_hud_open_scoreboard': 'panel',
	// Ground vehicles.
	'vehicle_driver.v_move_forward': 'drvFwd',
	'vehicle_driver.v_move_back': 'drvRev',
	'vehicle_driver.v_yaw_left': 'steerL',
	'vehicle_driver.v_yaw_right': 'steerR',
	'vehicle_driver.v_brake': 'brake',
	'vehicle_driver.v_yaw': 'steerL|steerR',
	'vehicle_general.mobiglas': 'panel',
	'vehicle_general.v_starmap': 'panel',
	// On foot.
	'player.moveforward': 'walkF',
	'player.moveback': 'walkB',
	'player.moveleft': 'walkL',
	'player.moveright': 'walkR',
	'player.sprint': 'sprint',
	'player.jump': 'jump',
	'player.crouch': 'crouch',
	'player.attack1': 'primary',
	'player.zoom': 'aim',
	'player.reload': 'reload',
	'player.weapon_melee': 'melee',
	'player.holster': 'holster',
	'player.toggle_flashlight': 'flash',
	'player.mobiglas': 'panel',
	'player.v_starmap': 'panel',
	'player_choice.pc_interaction_mode': 'interact',
	'player_choice.pc_qs_grenades': 'grenade',
	'default.toggle_contact': 'panel',
	'default.toggle_chat': 'panel'
};

/** The axes the 3D scene flies, drives and walks by. */
const ANALOG: Record<string, AnalogRole> = {
	'spaceship_movement.v_pitch': 'pitch',
	'spaceship_movement.v_roll': 'roll',
	'spaceship_movement.v_yaw': 'yaw',
	'spaceship_movement.v_strafe_longitudinal': 'throttle',
	'vehicle_driver.v_yaw': 'steer',
	'vehicle_driver.v_move': 'drive',
	'player.gp_movex': 'moveX',
	'player.gp_movey': 'moveY',
	'player.gp_rotateyaw': 'lookX',
	'player.gp_rotatepitch': 'lookY'
};

/**
 * How an action fires, as far as clashes go. The game tells a tap from a long press and a
 * double tap on the same key (X taps to release trim and holds to brake), so those don't
 * clash. UNVERIFIED: that a plain press and a tap on one key really do clash in game.
 */
function activationClass(mode: string): string {
	if (/^double_tap/.test(mode)) return 'double';
	if (/^delayed_|_long$/.test(mode)) return 'long';
	if (/^tap/.test(mode)) return 'tap';
	return '';
}

/**
 * An axis action takes an axis and nothing else. The file's `optionGroup` marks inputs
 * with an axis curve, buttons included (Strafe up has one, on Space), so an action counts
 * as an axis when it has one and no default that is a button.
 */
function isAxis(entry: DefaultAction): boolean {
	const [, , kb, mouse, js, gp, , axis] = entry;
	if (!axis) return false;
	const button = (v: string) =>
		v !== '' && !/^(maxis_|x$|y$|z$|rot[xyz]$|slider\d$|thumb[lr][xy]$|.*\+thumb[lr][xy]$)/.test(v);
	return ![kb, mouse, js, gp].some(button);
}

/** The game's label, tidied: no stray line breaks, sentence case left as the game has it. */
function tidy(label: string): string {
	return label
		.replace(/\\n|\n/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export interface CatalogueEntry {
	action: Action;
	map: string;
	/** The action's name in its map. */
	name: string;
	/** The game's defaults, by device kind, in the file's spelling. */
	defaults: { kb: string; mo: string; js: string; gp: string };
	activationMode: string;
}

function build(): CatalogueEntry[] {
	const entries: CatalogueEntry[] = [];
	const seen = new Map<string, number>();
	for (const { map, actions } of DEFAULT_MAPS) {
		const info = MAPS[map];
		if (!info) continue;
		for (const entry of actions) {
			const [name, label, kb, mo, js, gp, activationMode] = entry;
			const id = `${map}.${name}`;
			const axis = isAxis(entry);
			// The game shows Pitch for both the stick axis and the mouse: say which is which.
			let readable = tidy(label);
			if (/_mouse$/.test(name) && !/mouse/i.test(readable)) readable += ' (mouse)';
			const key = `${info.mode}|${info.category}|${readable}`;
			const n = (seen.get(key) ?? 0) + 1;
			seen.set(key, n);
			if (n > 1) readable += ` (${n})`;
			const cls = activationClass(activationMode);
			const context = [info.context, cls].filter(Boolean).join(' · ') || undefined;
			const action: Action = {
				id,
				name: readable,
				category: info.category,
				mode: info.mode,
				...(axis && { axis: true }),
				...(EFFECTS[id] && { effect: EFFECTS[id] }),
				...(ANALOG[id] && { analog: ANALOG[id] }),
				...(context && { context })
			};
			entries.push({ action, map, name, defaults: { kb, mo, js, gp }, activationMode });
		}
	}
	shareDefaults(entries);
	return entries;
}

/**
 * Groups the actions the game's defaults put on one input in the same mode and context
 * (`Action.shares`): Space jumps, holds the jump thrusters and climbs ledges by design, so
 * they don't clash with each other. Any other action on Space still clashes with them.
 */
function shareDefaults(entries: CatalogueEntry[]) {
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		const p = parent.get(id) ?? id;
		if (p === id) return id;
		const root = find(p);
		parent.set(id, root);
		return root;
	};
	const firstOn = new Map<string, string>();
	for (const { action, defaults } of entries) {
		for (const [device, text] of [
			['kb1', defaults.kb],
			['mo1', defaults.mo],
			['js1', defaults.js],
			['gp1', defaults.gp]
		] as const) {
			const bind = decodeBind(device, text);
			if (!bind) continue;
			const key = `${action.mode}|${action.context ?? ''}|${bindKey(bind)}`;
			const other = firstOn.get(key);
			if (!other) firstOn.set(key, action.id);
			else if (find(other) !== find(action.id)) parent.set(find(action.id), find(other));
		}
	}
	const sizes = new Map<string, number>();
	for (const { action } of entries) {
		const root = find(action.id);
		sizes.set(root, (sizes.get(root) ?? 0) + 1);
	}
	for (const { action } of entries) {
		const root = find(action.id);
		if ((sizes.get(root) ?? 0) > 1) action.shares = root;
	}
}

/** Every catalogued action, in the game's own order. Exported for the specs. */
export const CATALOGUE: readonly CatalogueEntry[] = build();

export const BY_ID: ReadonlyMap<string, CatalogueEntry> = new Map(
	CATALOGUE.map((e) => [e.action.id, e])
);

/** An action a layout names that the catalogue doesn't know (a newer patch, or a hidden one). */
export function unknownAction(map: string, name: string): Action {
	const info = MAPS[map];
	const words = name.replace(/^v_|^pc_/, '').replace(/_/g, ' ');
	return {
		id: `${map}.${name}`,
		name: words[0].toUpperCase() + words.slice(1),
		category: 'Other',
		mode: info?.mode ?? 'ship',
		...(info?.context && { context: info.context })
	};
}
