import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { act, initialFlight } from './flight.ts';
import { LOCAL_ACTIONS, withLocalActions } from './local-actions.ts';
import { parseEliteBinds, writeEliteBinds } from './sims/elite/index.ts';

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
});
