import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BindStore } from './binds.svelte.ts';
import { parseEliteBinds } from './sims/elite/index.ts';

const parsed = () => parseEliteBinds(readFileSync('tests/fixtures/hotas.binds', 'utf8'));
const P = { kind: 'key', code: 'KeyP' } as const;

describe('BindStore', () => {
	it('counts changes across modes, undoes per action and resets per mode', () => {
		const store = new BindStore();
		store.load(parsed(), { kind: 'preset', index: 0, label: 'Demo' });
		expect(store.changes).toBe(0);
		expect(store.counts.ship.clashes).toBeGreaterThan(0);

		store.settle({ actionId: 'SetSpeed50', slot: 0 }, { kind: 'apply' }, { input: P });
		store.settle({ actionId: 'HumanoidJumpButton', slot: 0 }, { kind: 'clear' }, null);
		expect(store.changes).toBe(2);
		expect(store.changedIn('ship')).toBe(1);
		expect(store.changedIn('foot')).toBe(1);

		store.undo('SetSpeed50');
		expect(store.isChanged('SetSpeed50')).toBe(false);
		store.resetMode('foot');
		expect(store.changes).toBe(0);
	});

	it('exports a file that parses back to the edited binds, leaving the source alone', () => {
		const store = new BindStore();
		const file = parsed();
		const source = file.source;
		store.load(file, { kind: 'upload', fileName: 'x.binds' });
		store.settle({ actionId: 'SetSpeed50', slot: 0 }, { kind: 'apply' }, { input: P });
		const out = store.exportFile('Rebound');
		expect(out?.fileName).toBe('Rebound.4.0.binds');
		const back = parseEliteBinds(out!.text);
		expect(back.presetName).toBe('Rebound');
		expect(back.bindings.SetSpeed50[0]).toEqual({ input: P });
		expect(store.file?.parsed.source).toBe(source);
	});
});
