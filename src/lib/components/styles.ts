/**
 * Class strings for the boards' recurring states, so every key, slot and chip draws the
 * same way. Colours are the theme package's tokens.
 */

export type KeyState = 'off' | 'spare' | 'bound' | 'clash' | 'lit' | 'listening';

export const KEY_CLASS: Record<KeyState, string> = {
	off: 'border-ink-900/20 bg-transparent text-ink-950/60',
	spare: 'border-ink-900/35 bg-transparent text-ink-900',
	bound: 'border-course bg-course-deep/18 text-ink-200',
	clash: 'border-alert bg-alert/12 text-alert',
	lit: 'border-trail bg-trail text-void',
	listening: 'pulse border-trail bg-trail/8 text-ink-200'
};

export type SlotState = 'empty' | 'bound' | 'clash' | 'listening' | 'picked';

export const SLOT_CLASS: Record<SlotState, string> = {
	empty: 'border-dashed border-ink-900/45 bg-transparent text-ink-900',
	bound: 'border-solid border-course bg-course-deep/16 text-ink-200',
	clash: 'border-solid border-alert bg-alert/12 text-alert',
	listening: 'pulse border-solid border-trail bg-trail/14 text-trail',
	picked: 'border-solid border-trail bg-trail/14 text-trail'
};

/** A toggle chip: category, Show filter, sim picker. */
export function chipClass(on: boolean): string {
	return on
		? 'border-ink-200 bg-ink-200 text-void'
		: 'border-course/30 bg-transparent text-ink-500 hover:border-course/60';
}
