import { afterEach, describe, expect, it, vi } from 'vitest';
import { consentKey, readConsent, writeConsent } from './consent.ts';

function memoryStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (key) => data.get(key) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (key) => void data.delete(key),
		setItem: (key, value) => void data.set(key, value)
	};
}

describe('consent', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('keys the choice by base path', () => {
		expect(consentKey('')).toBe('orbital-preflight:/:consent');
		expect(consentKey('/alice')).not.toBe(consentKey('/bob'));
	});

	it('reads back what was written, per base', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		expect(readConsent('')).toBeUndefined();
		writeConsent('', 'granted');
		expect(readConsent('')).toBe('granted');
		expect(readConsent('/other')).toBeUndefined();
	});

	it('reads blocked storage as unanswered', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			}
		});
		expect(readConsent('')).toBeUndefined();
	});
});
