/**
 * Builds `src/lib/orbital-preflight/sims/x4/controls.ts` from the game's own files, both
 * unpacked from the game's cat/dat archives (X Catalog Tool, or any copy of them):
 *
 * - `ui/addons/ego_gameoptions/gameoptions.lua`: the controls menu. Its `controlsorder`
 *   lists every row the Controls screen shows, tab by tab and section by section, and its
 *   `controlFunctions` the rows that rebind several controls at once ("Menu back" rebinds
 *   three actions).
 * - `t/0001-l044.xml`: the English text. Pages 1005, 1006 and 1007 name actions, states and
 *   ranges by number.
 *
 *   node scripts/x4-catalogue.ts <gameoptions.lua> <0001-l044.xml> <game version>
 *
 * The defaults themselves aren't generated: the app reads data/x4/inputmap.xml, the game's
 * "Keyboard and Mouse" profile, as it ships. Replace it after a patch and run this again.
 *
 * The menu names controls by number (`{ "states", 24 }`); binds files by name
 * (`INPUT_STATE_FIRE_PRIMARY_WEAPON`). Nothing the game ships pairs the two, so `IDS` below
 * does. UNVERIFIED: it was worked out by lining up a game-written inputmap.xml (which the
 * game writes in number order) against the numbered names, with the menu script's own
 * comments as anchors (states 120, 130 and 131). Check it again after a patch that adds
 * controls: a number the menu lists that `IDS` doesn't know stops the script.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = 'src/lib/orbital-preflight/sims/x4/controls.ts';

type Kind = 'actions' | 'states' | 'ranges';

const PAGES: Record<Kind, number> = { actions: 1005, states: 1006, ranges: 1007 };
const PREFIX: Record<Kind, string> = {
	actions: 'INPUT_ACTION_',
	states: 'INPUT_STATE_',
	ranges: 'INPUT_RANGE_'
};

/** Menu number → the name binds files use, without its `INPUT_<KIND>_` prefix. */
const IDS: Record<Kind, Record<number, string>> = {
	actions: {
		7: 'TOGGLEMOUSESTEERING',
		8: 'CYCLE_NEXT_PRIMARY_WEAPONGROUP',
		9: 'CYCLE_PREV_PRIMARY_WEAPONGROUP',
		10: 'CYCLE_NEXT_SECONDARY_WEAPONGROUP',
		11: 'CYCLE_PREV_SECONDARY_WEAPONGROUP',
		16: 'WIDGET_BACK',
		17: 'WIDGET_PAGEDOWN',
		18: 'WIDGET_PAGEUP',
		19: 'WIDGET_QUIT',
		20: 'WIDGET_SCROLL_DOWN',
		21: 'WIDGET_SCROLL_UP',
		22: 'WIDGET_TAB',
		97: 'DIALOG_1',
		98: 'DIALOG_2',
		99: 'DIALOG_3',
		100: 'DIALOG_4',
		101: 'DIALOG_5',
		102: 'DIALOG_6',
		103: 'DIALOG_BACK',
		104: 'DIALOG_CLOSE',
		113: 'OPEN_MAP',
		117: 'PAUSE',
		120: 'SCREENSHOT',
		121: 'TRIGGER_VIDEOMODE',
		123: 'STOP',
		124: 'EXECUTE_NOTIFICATION',
		128: 'INFO_ACTION',
		129: 'COMM_ACTION',
		130: 'QUICKSAVE',
		131: 'QUICKLOAD',
		132: 'OPTIONSMENU',
		137: 'OPEN_DEBUG_LOG',
		139: 'SELECT_PRIMARY_WEAPONGROUP_1',
		140: 'SELECT_PRIMARY_WEAPONGROUP_2',
		141: 'SELECT_PRIMARY_WEAPONGROUP_3',
		142: 'SELECT_PRIMARY_WEAPONGROUP_4',
		149: 'SELECT_SECONDARY_WEAPONGROUP_1',
		150: 'SELECT_SECONDARY_WEAPONGROUP_2',
		151: 'SELECT_SECONDARY_WEAPONGROUP_3',
		152: 'SELECT_SECONDARY_WEAPONGROUP_4',
		160: 'SAVEGAMEMENU',
		161: 'LOADGAMEMENU',
		162: 'QUITGAMEMENU',
		163: 'ADDON_DETAILMONITOR_I',
		164: 'ADDON_DETAILMONITOR_C',
		166: 'TOGGLECOCKPIT',
		167: 'TARGET_NEXT_ENEMY',
		168: 'TARGET_NEXT_TARGET',
		169: 'NEXT_TARGET_ACTION',
		170: 'PREV_TARGET_ACTION',
		175: 'DOCK_ACTION',
		178: 'TOGGLE_RADAR_MODE',
		179: 'TOGGLE_AUTOPILOT',
		180: 'COCKPIT_VIEW',
		181: 'EXTERNAL_VIEW',
		182: 'TARGET_VIEW',
		183: 'CAMERA_CHANGEMODE',
		184: 'CAMERA_RESETVIEW',
		198: 'DIALOG_POV_1',
		199: 'DIALOG_POV_2',
		200: 'DIALOG_POV_3',
		201: 'DIALOG_POV_4',
		202: 'DIALOG_POV_5',
		203: 'DIALOG_POV_6',
		// The map's copy of Toggle Auto Pilot (contexts.xml: "same assignment as
		// INPUT_ACTION_TOGGLE_AUTOPILOT").
		208: 'ADDON_DETAILMONITOR_A_SHIFT',
		209: 'OPEN_PROPERTY_MENU',
		210: 'OPEN_PLAYER_INVENTORY_MENU',
		211: 'UNDOCK',
		// The game-written file has these two the other way round; the names follow the
		// labels ("Next Surface Element" is 213).
		213: 'NEXT_SUBCOMPONENT',
		214: 'PREV_SUBCOMPONENT',
		216: 'ADDON_DETAILMONITOR_T',
		217: 'ADDON_DETAILMONITOR_RIGHT',
		218: 'ADDON_DETAILMONITOR_LEFT',
		219: 'MUTE',
		220: 'FP_RUN',
		221: 'TOGGLE_FLIGHT_ASSIST',
		222: 'ADDON_DETAILMONITOR_P',
		223: 'TOGGLE_HUD',
		224: 'TOGGLETEXT',
		225: 'TOGGLE_SETA_MODE',
		231: 'ADDON_DETAILMONITOR_F1',
		232: 'ADDON_DETAILMONITOR_F3',
		260: 'VR_RESET',
		261: 'TOGGLE_STEERING_AXIS',
		262: 'FLOATING_VIEW',
		263: 'ADDON_DETAILMONITOR_REMOVE_ORDER',
		264: 'ADDON_DETAILMONITOR_ZONE_VIEW',
		265: 'ADDON_DETAILMONITOR_SECTOR_VIEW',
		275: 'TOGGLE_TARGET_LOCK',
		277: 'GET_UP',
		289: 'DESELECT_TARGET',
		294: 'DIALOG_MENU_SELECT',
		299: 'DIALOG_MENU_UP',
		300: 'DIALOG_MENU_DOWN',
		301: 'DIALOG_MENU_LEFT',
		302: 'DIALOG_MENU_RIGHT',
		303: 'TOGGLE_TRAVEL_MODE',
		304: 'TOGGLE_SCAN_MODE',
		305: 'TOGGLE_LONGRANGE_SCAN_MODE',
		306: 'TOGGLE_FPS_DISPLAY',
		307: 'DEPLOY_COUNTERMEASURE',
		308: 'WIDGET_TABSCROLL_RIGHT',
		309: 'WIDGET_TABSCROLL_LEFT',
		310: 'SHOW_CHAT_WINDOW',
		312: 'ADDON_DETAILMONITOR_CLOSE_MAP',
		314: 'OPEN_MISSIONS',
		315: 'ADDON_DETAILMONITOR_MISSIONS',
		316: 'OPEN_PLAYERSHIP_INFO',
		317: 'OPEN_COCKPIT_MENU',
		318: 'CYCLE_VIEW',
		319: 'TOGGLE_GUIDANCE',
		320: 'HELP',
		321: 'CYCLE_NEXT_ACTIVE_WEAPON_AMMO',
		322: 'ADDON_DETAILMONITOR_TRAVELMODE',
		323: 'ADDON_DETAILMONITOR_SETA',
		324: 'TOGGLEDIRECTMOUSESTEERING',
		325: 'VR_TOGGLE_TRACKING',
		326: 'ADDON_HELPTEXT_CLOSE',
		327: 'SCAN_ACTION',
		328: 'TOGGLE_TURRET_ACTIVE',
		329: 'TOGGLE_DRONE_LAUNCH',
		330: 'TOGGLEAUTOROLL',
		331: 'TOGGLEAIMASSIST',
		332: 'ADDON_DETAILMONITOR_MULTIVERSE',
		336: 'ADDON_HELPTEXT_RIGHT',
		337: 'ADDON_HELPTEXT_LEFT',
		343: 'SQUAD_ATTACK_TARGET',
		344: 'SQUAD_RESUME_ASSIGNMENT',
		345: 'DEPLOY_SATELLITE',
		346: 'DEPLOY_NAVBEACON',
		347: 'DEPLOY_RESOURCEPROBE',
		348: 'DEPLOY_MINE',
		349: 'DEPLOY_LASERTOWER',
		350: 'REPEAT_DEPLOYMENT',
		351: 'REPEAT_CIVILIAN_DEPLOYMENT',
		352: 'REPEAT_MILITARY_DEPLOYMENT',
		353: 'CINEMATIC_CAMERA',
		363: 'OPEN_MULTIVERSE',
		364: 'TELEPORT_ACTION',
		365: 'ADDON_DETAILMONITOR_TELEPORT',
		366: 'ZOOMGOGGLES',
		367: 'ZOOMGOGGLES_RESET',
		368: 'EDIT_FOLLOWCAM_OFFSET',
		369: 'ADDON_DETAILMONITOR_PROPERTY_OWNED',
		370: 'ADDON_DETAILMONITOR_CURRENT_SHIP',
		371: 'ADDON_DETAILMONITOR_CONTEXT_MENU',
		372: 'ADDON_DETAILMONITOR_CLOSE_PLAYERINFO',
		373: 'ADDON_DETAILMONITOR_CLOSE_HELP',
		374: 'TOGGLE_REDUCED_SPEED_MODE',
		375: 'ADDON_HELPTEXT_BACK',
		376: 'DIALOG_SKIPLINE',
		377: 'TOGGLE_COVER',
		378: 'ADDON_DETAILMONITOR_CLOSE_FOLLOWCAM_OFFSET',
		379: 'OPEN_DIPLOMACY_MENU',
		380: 'ADDON_DETAILMONITOR_CLOSE_DIPLOMACY',
		381: 'TOGGLE_STANCE'
	},
	states: {
		1: 'DIALOG_MENU',
		2: 'STEER_LEFT',
		3: 'STEER_RIGHT',
		4: 'STEER_UP',
		5: 'STEER_DOWN',
		6: 'STRAFE_LEFT',
		7: 'STRAFE_RIGHT',
		8: 'STRAFE_UP',
		9: 'STRAFE_DOWN',
		10: 'WIDGET_SCROLL_LEFT',
		11: 'WIDGET_SCROLL_RIGHT',
		12: 'WIDGET_SELECT',
		13: 'ACCELERATE',
		14: 'DECELERATE',
		15: 'FULLFORWARD',
		16: 'FULLREVERSE',
		17: 'BOOST',
		18: 'ROLL_LEFT',
		19: 'ROLL_RIGHT',
		20: 'TOGGLEMOUSESTEERING',
		22: 'INTERACTION_MENU',
		23: 'FP_INTERACTION_MENU',
		24: 'FIRE_PRIMARY_WEAPON',
		25: 'FIRE_SECONDARY_WEAPON',
		26: 'FP_MOVE_FORWARD',
		27: 'FP_MOVE_BACKWARD',
		28: 'FP_TURN_LEFT',
		29: 'FP_TURN_RIGHT',
		30: 'FP_LOOK_UP',
		31: 'FP_LOOK_DOWN',
		32: 'FP_STRAFE_LEFT',
		33: 'FP_STRAFE_RIGHT',
		34: 'FP_CROUCH',
		35: 'FP_WALK',
		36: 'FP_JUMP',
		37: 'MAP_ZOOM_IN',
		38: 'MAP_ZOOM_OUT',
		39: 'MAP_PAN_LEFT',
		40: 'MAP_PAN_RIGHT',
		41: 'MAP_PAN_UP',
		42: 'MAP_PAN_DOWN',
		43: 'MAP_ROTATE_LEFT',
		44: 'MAP_ROTATE_RIGHT',
		45: 'MAP_ROTATE_UP',
		46: 'MAP_ROTATE_DOWN',
		48: 'FIRE_PRIMARY_WEAPON_AT_CURSOR',
		70: 'CAMERA_ZOOMIN',
		71: 'CAMERA_ZOOMOUT',
		72: 'CAMERA_LEFT',
		73: 'CAMERA_RIGHT',
		74: 'CAMERA_UP',
		75: 'CAMERA_DOWN',
		76: 'CAMERA_UP_LEFT',
		77: 'CAMERA_UP_RIGHT',
		78: 'CAMERA_DOWN_LEFT',
		79: 'CAMERA_DOWN_RIGHT',
		80: 'LOOTMAGNET',
		81: 'CAMERA_MOUSELOOK',
		87: 'FP_RUN_FORWARD',
		90: 'INVERT_THROTTLE',
		91: 'MATCH_SPEED',
		92: 'CONTROLLERMOUSEBUTTON_LEFT',
		93: 'CONTROLLERMOUSEBUTTON_RIGHT',
		94: 'CONTROLLERMOUSEBUTTON_MIDDLE',
		95: 'MAP_PAN_TO_ROTATE',
		96: 'ADDON_CHATWINDOW_COMMANDBAR',
		97: 'WIDGET_INTERACT',
		98: 'DETAILMONITOR_RESET_VIEW',
		99: 'CONTROLLERMOUSE_LEFT',
		100: 'CONTROLLERMOUSE_RIGHT',
		101: 'CONTROLLERMOUSE_UP',
		102: 'CONTROLLERMOUSE_DOWN',
		103: 'CONTROLLERMOUSE_UP_LEFT',
		104: 'CONTROLLERMOUSE_UP_RIGHT',
		105: 'CONTROLLERMOUSE_DOWN_LEFT',
		106: 'CONTROLLERMOUSE_DOWN_RIGHT',
		112: 'STEER_UP_LEFT',
		113: 'STEER_UP_RIGHT',
		114: 'STEER_DOWN_LEFT',
		115: 'STEER_DOWN_RIGHT',
		116: 'STRAFE_UP_LEFT',
		117: 'STRAFE_UP_RIGHT',
		118: 'STRAFE_DOWN_LEFT',
		119: 'STRAFE_DOWN_RIGHT',
		121: 'DETAILMONITOR_TOGGLE_FILTER_1',
		122: 'DETAILMONITOR_TOGGLE_FILTER_2',
		123: 'DETAILMONITOR_TOGGLE_FILTER_3',
		126: 'COMPASSMENU',
		127: 'COMPASSMENU_2',
		128: 'SLIDERCELL_SCROLL_LEFT_SHIFT',
		129: 'SLIDERCELL_SCROLL_RIGHT_SHIFT',
		130: 'TARGETMOUSE_SELECT',
		131: 'TARGETMOUSE_INTERACTION_MENU',
		133: 'SUSPEND_FLIGHT_ASSIST'
	},
	ranges: {
		2: 'STEERING_PITCH',
		4: 'THROTTLE',
		5: 'STRAFE_LEFT_RIGHT',
		6: 'STRAFE_UP_DOWN',
		10: 'MOUSEWHEEL',
		11: 'MENUSCROLL_X',
		12: 'MENUSCROLL_Y',
		13: 'FP_YAW',
		14: 'FP_PITCH',
		15: 'FP_WALK',
		16: 'FP_STRAFE',
		21: 'STEERING_PRIMARY',
		22: 'STEERING_SECONDARY',
		23: 'CONTROLLERMOUSECURSOR_X',
		24: 'CONTROLLERMOUSECURSOR_Y',
		25: 'MAP_PAN_LEFT_RIGHT',
		26: 'MAP_PAN_UP_DOWN',
		27: 'MAP_ROTATE_LEFT_RIGHT',
		28: 'MAP_ROTATE_UP_DOWN',
		30: 'MOUSESTEERING_PITCH',
		32: 'MOUSESTEERING_PRIMARY',
		33: 'MOUSESTEERING_SECONDARY',
		36: 'COMPASSMENU_SCROLL_X',
		37: 'COMPASSMENU_SCROLL_Y',
		38: 'MAP_ZOOM_IN',
		39: 'MAP_ZOOM_OUT'
	}
};

/**
 * The menu's tabs. Debug, cheat and dev rows don't appear in any of them, and sections it
 * marks `mappable = false` (menu and dialog navigation) are left out.
 */
const TABS = ['firstperson', 'space', 'menus'] as const;

/** `{page,id}` in the text, resolved; `(comments)` dropped; `\(` kept as a bracket. */
function texts(path: string) {
	const pages = new Map<number, Map<number, string>>();
	const source = readFileSync(path, 'utf8');
	for (const [, page, body] of source.matchAll(/<page id="(\d+)"[^>]*>([\s\S]*?)<\/page>/g)) {
		const entries = new Map<number, string>();
		for (const [, id, text] of body.matchAll(/<t id="(\d+)">([\s\S]*?)<\/t>/g)) {
			entries.set(Number(id), text);
		}
		pages.set(Number(page), entries);
	}
	const raw = (page: number, id: number, depth = 0): string => {
		const text = pages.get(page)?.get(id) ?? '';
		if (depth > 5) return text;
		return text.replace(/\{(\d+),\s*(\d+)\}/g, (_, p, t) => raw(Number(p), Number(t), depth + 1));
	};
	return (page: number, id: number) =>
		decode(
			raw(page, id)
				.replace(/(?<!\\)\([^)]*\)/g, '')
				.replace(/\\([()])/g, '$1')
				.replace(/\s+/g, ' ')
				.trim()
		);
}

function decode(text: string): string {
	return text
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

/** The Lua table literal after `name = `, as text, by brace matching. */
function luaTable(lua: string, name: string): string {
	const start = lua.indexOf(`${name} = {`);
	if (start < 0) throw new Error(`No ${name} in gameoptions.lua`);
	let depth = 0;
	for (let i = lua.indexOf('{', start); i < lua.length; i++) {
		if (lua[i] === '{') depth++;
		else if (lua[i] === '}' && --depth === 0) return lua.slice(start, i + 1);
	}
	throw new Error(`Unclosed ${name}`);
}

/** Splits a Lua table body into its top-level `{ … }` entries. */
function entries(body: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let from = -1;
	for (let i = 0; i < body.length; i++) {
		if (body[i] === '{') {
			if (depth === 0) from = i;
			depth++;
		} else if (body[i] === '}') {
			depth--;
			if (depth === 0 && from >= 0) out.push(body.slice(from, i + 1));
		}
	}
	return out;
}

const numbers = (text: string | undefined) => [...(text ?? '').matchAll(/\d+/g)].map((m) => +m[0]);

function main([luaPath, textPath, version]: string[]) {
	if (!luaPath || !textPath || !version) {
		throw new Error(
			'Usage: node scripts/x4-catalogue.ts <gameoptions.lua> <0001-l044.xml> <version>'
		);
	}
	const text = texts(textPath);
	const lua = readFileSync(luaPath, 'utf8')
		.split('\n')
		.map((line) => line.replace(/--.*$/, ''))
		.join('\n');

	const idOf = (kind: Kind, n: number) => {
		const name = IDS[kind][n];
		if (!name) throw new Error(`No name for ${kind} ${n} (${text(PAGES[kind], n)}): add it to IDS`);
		return PREFIX[kind] + name;
	};

	// Functions: one row, several controls. The defining control names the row.
	const functions = new Map<number, { name: string; ids: string[]; contexts: number[] }>();
	const fnTable = luaTable(lua, 'config.input.controlFunctions');
	for (const [, n, body] of fnTable.matchAll(/\[(\d+)\] = \{([\s\S]*?)\n\t\},/g)) {
		const [, page, id] = /ReadText\((\d+), (\d+)\)/.exec(body) ?? [];
		const [, dKind, dNum] = /"definingcontrol"\] = \{"(\w+)", (\d+)\}/.exec(body) ?? [];
		const ids = [idOf(dKind as Kind, Number(dNum))];
		for (const kind of ['actions', 'states', 'ranges'] as Kind[]) {
			const list = new RegExp(`\\["${kind}"\\] = \\{([^}]*)\\}`).exec(body)?.[1];
			for (const m of numbers(list)) {
				const full = idOf(kind, m);
				if (!ids.includes(full)) ids.push(full);
			}
		}
		const contexts = numbers(/\["contexts"\]\s*=\s*\{([^}]*)\}/.exec(body)?.[1]);
		functions.set(Number(n), { name: text(Number(page), Number(id)), ids, contexts });
	}

	const order = luaTable(lua, 'config.input.controlsorder');
	const controls: unknown[] = [];
	const seen = new Set<string>();
	let count = 0;
	for (const tab of TABS) {
		const tabBody = new RegExp(`\\["${tab}"\\] = \\{`).exec(order);
		if (!tabBody) throw new Error(`No ${tab} tab`);
		const tabText = luaTable(order.slice(tabBody.index).replace(`["${tab}"]`, 'tab'), 'tab');
		for (const section of entries(tabText.slice(tabText.indexOf('{') + 1, -1))) {
			const [, tPage, tId] = /\["title"\] = ReadText\((\d+), (\d+)\)/.exec(section) ?? [];
			const category = text(Number(tPage), Number(tId));
			// Sections the Controls screen shows but won't let a pilot change.
			if (/\["mappable"\] = false/.test(section)) continue;
			for (const row of entries(section.slice(1, -1))) {
				const m =
					/^\{\s*"(actions|states|ranges|functions)",\s*(\d+)\s*(?:,\s*(\{[^}]*\}|\d+|nil))?/.exec(
						row
					);
				if (!m) continue;
				const [, kind, num, ctx] = m;
				let ids: string[];
				let label: string;
				let contexts: number[];
				if (kind === 'functions') {
					const fn = functions.get(Number(num));
					if (!fn) throw new Error(`No function ${num}`);
					({ ids, contexts } = fn);
					label = fn.name;
					// A row's own context list, where it gives one, wins over the function's.
					if (ctx && ctx !== 'nil') contexts = numbers(ctx);
				} else {
					ids = [idOf(kind as Kind, Number(num))];
					label = text(PAGES[kind as Kind], Number(num));
					contexts = ctx && ctx !== 'nil' ? numbers(ctx) : [1];
				}
				// A row the menu shows in two places (Interact) is listed once, where it first
				// appears: both rebind the same controls. First person comes first, so Interact
				// is an on-foot control, as it is at Pad 7's consoles.
				if (seen.has(ids[0])) continue;
				seen.add(ids[0]);
				count++;
				controls.push([tab, category, label, kind === 'ranges' ? 1 : 0, contexts, ids]);
			}
		}
	}

	const source = `/**
 * GENERATED by scripts/x4-catalogue.ts from X4: Foundations ${version}'s controls menu
 * (ui/addons/ego_gameoptions/gameoptions.lua) and English text (t/0001-l044.xml). Don't
 * edit by hand: run the script on a newer game's files.
 *
 * Each row of the game's Controls screen, in its order: [tab, section, label, axis,
 * contexts, ids]. \`ids\` are the controls the row rebinds, the one it is named after first.
 * \`contexts\` are the menu's own groups: two rows in one tab clash when they share one.
 */

export const GAME_VERSION = ${JSON.stringify(version)};

export type ControlRow = [
	tab: 'space' | 'firstperson' | 'menus',
	section: string,
	label: string,
	axis: 0 | 1,
	contexts: number[],
	ids: string[]
];

export const CONTROLS: ControlRow[] = ${JSON.stringify(controls)};
`;
	writeFileSync(OUT, source);
	execFileSync('pnpm', ['exec', 'prettier', '--write', OUT], { stdio: 'inherit' });
	console.log(`${count} controls → ${OUT}`);
}

main(process.argv.slice(2));
