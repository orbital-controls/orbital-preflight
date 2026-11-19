import { describe, expect, it } from 'vitest';
import { InputHub } from './hub.svelte.ts';
import type { Bind, InputId } from '../types.ts';

const key = (code: string): InputId => ({ kind: 'key', code });

function listening() {
	const hub = new InputHub();
	const picked: Bind[] = [];
	let cancelled = 0;
	hub.capture(
		(b) => picked.push(b),
		() => cancelled++
	);
	return { hub, picked, cancelled: () => cancelled };
}

describe('InputHub capture', () => {
	it('Shift held with Z gives Shift+Z, whichever is let go first', () => {
		const { hub, picked } = listening();
		hub.press(key('ShiftLeft'));
		hub.press(key('KeyZ'));
		hub.release(key('KeyZ'));
		hub.release(key('ShiftLeft'));
		expect(picked).toEqual([{ input: key('KeyZ'), modifiers: [key('ShiftLeft')] }]);
	});

	it('Shift pressed and let go alone binds Shift', () => {
		const { hub, picked } = listening();
		hub.press(key('ShiftLeft'));
		hub.release(key('ShiftLeft'));
		expect(picked).toEqual([{ input: key('ShiftLeft') }]);
	});

	it('nothing reaches the flight while listening', () => {
		const { hub } = listening();
		const seen: unknown[] = [];
		hub.subscribe((e) => seen.push(e));
		hub.press(key('KeyL'));
		hub.release(key('KeyL'));
		expect(seen).toEqual([]);
	});

	it('requires every modifier of a bind to be held', () => {
		const hub = new InputHub();
		hub.press(key('ShiftLeft'));
		expect(hub.modifiersHeld([key('ShiftLeft')])).toBe(true);
		expect(hub.modifiersHeld([key('ShiftLeft'), key('ControlLeft')])).toBe(false);
	});
});
