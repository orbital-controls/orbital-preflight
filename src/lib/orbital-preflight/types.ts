/**
 * The model every sim adapter reads into and writes out of. Nothing here knows about
 * any one game's file format: the Elite Dangerous adapter (`sims/elite`) maps its
 * Device/Key pairs onto these, and back.
 */

export type SimId = 'elite-dangerous' | 'star-citizen' | 'x4' | 'dcs';

/** Where an action applies. Every sim we support has a ship, a ground vehicle and a body. */
export type Mode = 'ship' | 'srv' | 'foot';

export const MODES: readonly Mode[] = ['ship', 'srv', 'foot'];

export const MODE_NAMES: Record<Mode, string> = { ship: 'Ship', srv: 'SRV', foot: 'On foot' };

export interface Action {
	/** The sim's own id for the action, e.g. `ToggleFlightAssist`. */
	id: string;
	/** A readable name, e.g. "Flight assist". */
	name: string;
	category: string;
	mode: Mode;
	/** Analogue actions take an axis in their primary slot and have no secondary slot. */
	axis?: boolean;
	/**
	 * What the action does in the mock flight (`flight.ts`), e.g. `gear`. Axis actions
	 * name one effect per direction, `neg|pos` (`yawL|yawR`), or `throttle`.
	 */
	effect?: string;
	/**
	 * Binds in the same mode only clash within the same context. Menus, the camera suite
	 * and scanners read keys separately from flight, so W can steer menus and pitch.
	 */
	context?: string;
	/**
	 * Actions in the same group share inputs on purpose: the sim's own defaults put them on
	 * one key (Star Citizen's Space jumps, fires the jump thrusters and climbs ledges). They
	 * don't clash with each other, but still clash with any other action on that input.
	 */
	shares?: string;
	/**
	 * Which flight axis an analogue action drives, for the 3D scene: a bound stick or
	 * throttle axis moves the ship directly rather than through the mock flight's steps.
	 */
	analog?: AnalogRole;
	/**
	 * Kept by Orbital Preflight, not by the sim: listed and rebindable like any other
	 * action, but never written to an export (e.g. "Toggle camera").
	 */
	local?: boolean;
}

export type AnalogRole =
	'pitch' | 'roll' | 'yaw' | 'throttle' | 'steer' | 'drive' | 'moveX' | 'moveY' | 'lookX' | 'lookY';

export type HatDirection = 'up' | 'down' | 'left' | 'right';

/**
 * One physical input. Keyboard keys use the browser's `KeyboardEvent.code` ("KeyA",
 * "ShiftLeft"); `deviceId` is the device's name in the binds file (e.g. `T16000M`,
 * `231D0200`), so a bind can name a device the browser hasn't seen yet. `raw` keeps any
 * Device/Key pair we don't understand, so it survives a round trip and still shows up.
 */
export type InputId =
	| { kind: 'key'; code: string }
	| { kind: 'mouse'; button: number }
	| { kind: 'wheel'; dir: 'up' | 'down' }
	| { kind: 'button'; deviceId: string; button: number }
	| { kind: 'hat'; deviceId: string; hat: number; dir: HatDirection }
	| { kind: 'axis'; deviceId: string; axis: string; half?: 'pos' | 'neg' }
	| { kind: 'pad'; deviceId: string; control: PadControl; half?: 'pos' | 'neg' }
	| { kind: 'raw'; device: string; key: string };

/**
 * A gamepad control by the name Elite gives it after `GamePad_` (`FaceDown`, `LStickX`,
 * `RTrigger`…). Sticks and triggers are axes; a `half` is one direction of one.
 */
export type PadControl = string;

/**
 * One slot: an input, optionally held with modifiers (Shift, Ctrl, or a stick button).
 * Most binds have none or one; a file can hold more. `null` is an empty slot.
 */
export interface Bind {
	input: InputId;
	modifiers?: InputId[];
}

export type Slot = Bind | null;

/** Primary and secondary. Axis actions only use the primary slot. */
export type Binding = [Slot, Slot];

export type SlotIndex = 0 | 1;

/** Bindings keyed by action id. */
export type BindingMap = Record<string, Binding>;

/** A device named in a binds file. */
export interface FileDevice {
	/** The name the file uses, e.g. `T16000M`. */
	id: string;
	/** A readable name where we know one. */
	name: string;
	/** The file binds it by gamepad control names (`GamePad_FaceDown`), not `Joy_` ones. */
	gamepad?: true;
	/** USB vendor and product id (lowercase hex) where the file name gives them away. */
	vendor?: string;
	product?: string;
}

/** What a sim adapter hands back from a file. */
export interface ParsedBinds {
	sim: SimId;
	presetName: string;
	actions: Action[];
	bindings: BindingMap;
	devices: FileDevice[];
	/** The file exactly as read, for the writer to splice into. */
	source: string;
}
