import type { Action, AnalogRole, Mode } from '../../types.ts';
import { CONTROLS, type ControlRow } from './controls.ts';

/**
 * X4's actions: every row its Controls screen lets a pilot rebind (`controls.ts`, generated
 * from the game's menu), each under the game's own section name. An action's id is the
 * control the row is named after (`INPUT_STATE_BOOST`); a row that rebinds several
 * controls at once ("Map" opens and closes the map) writes the same binds to all of them.
 *
 * The Space and Menus tabs are the ship; First person is on foot. X4 has no ground
 * vehicle, so there is no SRV tab.
 */

const MODES: Record<ControlRow[0], Mode> = { space: 'ship', menus: 'ship', firstperson: 'foot' };

/** What a control does in the mock flight (`flight.ts`). */
const EFFECTS: Record<string, string> = {
	// Ship. Travel mode stands in for supercruise; X4's guns are always deployed.
	INPUT_STATE_ACCELERATE: 'thrUp',
	INPUT_STATE_DECELERATE: 'thrDn',
	INPUT_ACTION_STOP: 'thrZero',
	INPUT_STATE_STEER_LEFT: 'yawL',
	INPUT_STATE_STEER_RIGHT: 'yawR',
	INPUT_STATE_ROLL_LEFT: 'rollL',
	INPUT_STATE_ROLL_RIGHT: 'rollR',
	INPUT_STATE_STRAFE_UP: 'up',
	INPUT_STATE_STRAFE_DOWN: 'down',
	INPUT_STATE_BOOST: 'boost',
	INPUT_ACTION_TOGGLE_FLIGHT_ASSIST: 'fa',
	INPUT_ACTION_TOGGLE_TRAVEL_MODE: 'sc',
	INPUT_STATE_FIRE_PRIMARY_WEAPON: 'fire',
	INPUT_STATE_FIRE_PRIMARY_WEAPON_AT_CURSOR: 'fire',
	INPUT_STATE_FIRE_SECONDARY_WEAPON: 'fire2',
	INPUT_ACTION_TARGET_NEXT_ENEMY: 'tgt',
	INPUT_ACTION_TARGET_NEXT_TARGET: 'tgt',
	INPUT_ACTION_NEXT_TARGET_ACTION: 'tgt',
	INPUT_ACTION_PREV_TARGET_ACTION: 'tgt',
	INPUT_STATE_TARGETMOUSE_SELECT: 'tgt',
	INPUT_ACTION_DEPLOY_COUNTERMEASURE: 'chaff',
	INPUT_ACTION_TOGGLE_LONGRANGE_SCAN_MODE: 'ping',
	INPUT_ACTION_OPEN_MAP: 'panel',
	INPUT_ACTION_OPEN_MISSIONS: 'panel',
	INPUT_ACTION_OPEN_PROPERTY_MENU: 'panel',
	INPUT_ACTION_OPEN_MULTIVERSE: 'panel',
	INPUT_ACTION_OPEN_PLAYERSHIP_INFO: 'panel',
	INPUT_ACTION_OPEN_PLAYER_INVENTORY_MENU: 'panel',
	INPUT_ACTION_OPEN_DIPLOMACY_MENU: 'panel',
	INPUT_ACTION_OPEN_COCKPIT_MENU: 'panel',
	INPUT_ACTION_HELP: 'panel',
	INPUT_ACTION_OPTIONSMENU: 'panel',
	// On foot.
	INPUT_STATE_FP_MOVE_FORWARD: 'walkF',
	INPUT_STATE_FP_MOVE_BACKWARD: 'walkB',
	INPUT_STATE_FP_STRAFE_LEFT: 'walkL',
	INPUT_STATE_FP_STRAFE_RIGHT: 'walkR',
	INPUT_ACTION_FP_RUN: 'sprint',
	INPUT_STATE_FP_JUMP: 'jump',
	INPUT_STATE_FP_CROUCH: 'crouch',
	INPUT_STATE_INTERACTION_MENU: 'interact',
	// Ranges.
	INPUT_RANGE_STEERING_PRIMARY: 'yawL|yawR',
	INPUT_RANGE_STEERING_SECONDARY: 'rollL|rollR',
	INPUT_RANGE_STRAFE_UP_DOWN: 'down|up',
	INPUT_RANGE_THROTTLE: 'throttle'
};

/**
 * The axes the 3D scene flies and walks by. The primary steering axis yaws and the
 * secondary rolls until the pilot swaps them in game (Toggle Steering Axis).
 */
const ANALOG: Record<string, AnalogRole> = {
	INPUT_RANGE_STEERING_PITCH: 'pitch',
	INPUT_RANGE_STEERING_PRIMARY: 'yaw',
	INPUT_RANGE_STEERING_SECONDARY: 'roll',
	INPUT_RANGE_THROTTLE: 'throttle',
	INPUT_RANGE_FP_WALK: 'moveY',
	INPUT_RANGE_FP_STRAFE: 'moveX',
	INPUT_RANGE_FP_YAW: 'lookX',
	INPUT_RANGE_FP_PITCH: 'lookY'
};

/**
 * Two rows clash only when the game would say so: in the same tab and sharing one of the
 * menu's contexts. Rows that include the main one (1) all share it; the rest (camera-only,
 * map-only and the like) get a context of their own. The Menus tab never clashes with
 * flight: the game checks one tab at a time.
 */
function contextOf(tab: ControlRow[0], contexts: number[]): string | undefined {
	if (tab === 'menus') return `menus ${contexts.join('+')}`;
	if (contexts.includes(1)) return undefined;
	return `context ${contexts.join('+')}`;
}

export interface CatalogueEntry {
	action: Action;
	/** Every control the row rebinds, `action.id` first. */
	ids: string[];
}

function build(): CatalogueEntry[] {
	const counts = new Map<string, number>();
	for (const [tab, , label] of CONTROLS) {
		const key = `${MODES[tab]}|${label}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return CONTROLS.map(([tab, section, label, axis, contexts, ids]) => {
		const mode = MODES[tab];
		// The game names the walking axis and the walk key both "Walk": say which is which.
		const name = axis && (counts.get(`${mode}|${label}`) ?? 0) > 1 ? `${label} (axis)` : label;
		const id = ids[0];
		const context = contextOf(tab, contexts);
		const action: Action = {
			id,
			name,
			category: section,
			mode,
			...(axis && { axis: true }),
			...(EFFECTS[id] && { effect: EFFECTS[id] }),
			...(ANALOG[id] && { analog: ANALOG[id] }),
			...(context && { context })
		};
		return { action, ids };
	});
}

/** Every catalogued action, in the game's own order. */
export const CATALOGUE: readonly CatalogueEntry[] = build();

export const BY_ID: ReadonlyMap<string, CatalogueEntry> = new Map(
	CATALOGUE.map((e) => [e.action.id, e])
);
