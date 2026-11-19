import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { act, initialFlight } from './flight.ts';
import { LOCAL_ACTIONS, withLocalActions } from './local-actions.ts';
import { filterCounts } from './bindings.ts';
import { parseEliteBinds, writeEliteBinds } from './sims/elite/index.ts';
import type { Binding } from './types.ts';

const source = readFileSync('tests/fixtures/hotas.binds', 'utf8');

describe('local actions', () => {
	it('adds Toggle camera to the ship panels, bound to K', () => {
		const parsed = withLocalActions(parseEliteBinds(source));
		const camera = parsed.actions.find((a) => a.id === 'OrbitalPreflightToggleCamera');
		expect(camera).toMatchObject({
			category: 'Panels',
			mode: 'ship',
			effect: 'camera',
			local: true
		});
		expect(parsed.bindings.OrbitalPreflightToggleCamera[0]).toEqual({
			input: { kind: 'key', code: 'KeyK' }
		});
	});

	it('is never written to an export, even when rebound', () => {
		const parsed = withLocalActions(parseEliteBinds(source));
		const out = writeEliteBinds(
			parsed,
			{
				...parsed.bindings,
				OrbitalPreflightToggleCamera: [{ input: { kind: 'key', code: 'KeyP' } }, null]
			},
			'Test'
		);
		expect(out).not.toContain('OrbitalPreflight');
		expect(out).toBe(
			writeEliteBinds(parseEliteBinds(source), parseEliteBinds(source).bindings, 'Test')
		);
	});

	it('leaves a file alone that already has the id', () => {
		const parsed = parseEliteBinds(source);
		const id = LOCAL_ACTIONS[0].action.id;
		const already = {
			...parsed,
			bindings: { ...parsed.bindings, [id]: [null, null] as [null, null] }
		};
		expect(withLocalActions(already)).toBe(already);
	});

	it('the camera effect toggles chase and cockpit', () => {
		const once = act(initialFlight(), 'camera', 'Toggle camera');
		expect(once.cam).toBe('cockpit');
		expect(act(once, 'camera', 'Toggle camera').cam).toBe('chase');
	});

	it('leaves the default off when the file already uses K in ship mode', () => {
		const taken = source.replace(
			/<CycleNextTarget>\s*<Primary Device="[^"]*" Key="[^"]*"/,
			'<CycleNextTarget>\n\t\t<Primary Device="Keyboard" Key="Key_K"'
		);
		expect(taken).not.toBe(source);
		const parsed = withLocalActions(parseEliteBinds(taken));
		expect(parsed.bindings.OrbitalPreflightToggleCamera).toEqual([null, null]);
		expect(parsed.actions.some((a) => a.id === 'OrbitalPreflightToggleCamera')).toBe(true);
	});

	it('a rebound local action is not an unsaved change', () => {
		const parsed = withLocalActions(parseEliteBinds(source));
		const moved = {
			...parsed.bindings,
			OrbitalPreflightToggleCamera: [{ input: { kind: 'key', code: 'KeyP' } }, null] as Binding
		};
		expect(filterCounts(parsed.actions, moved, parsed.bindings, 'ship').changed).toBe(0);
	});
});
