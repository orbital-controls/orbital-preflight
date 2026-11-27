/**
 * Adaptive render resolution. Software WebGL (no GPU: CI runners, some laptops) pays for
 * every pixel on the CPU; a heavy scene there drops to a few frames a second and starves
 * the page's own timers, so the mock flight crawls. The engine checks the frame interval
 * about once a second and steps the pixel ratio down while frames are slow, and back up
 * to the cap while there is headroom. A machine with a GPU stays at the cap. Pure.
 */

export const RESOLUTION = {
	/** Never below this pixel ratio. */
	min: 0.5,
	/** Slower than this (ms between frames, under 25 fps): step down. */
	slowMs: 40,
	/** Faster than this (over 50 fps): step back up. */
	fastMs: 20,
	down: 0.7,
	up: 1 / 0.85,
	/** Seconds between changes, so the interval average settles first. */
	settle: 1.5
} as const;

/** The pixel ratio to use next, given the current one, the cap and the frame interval. */
export function nextPixelRatio(current: number, cap: number, intervalMs: number): number {
	if (intervalMs > RESOLUTION.slowMs && current > RESOLUTION.min)
		return Math.max(RESOLUTION.min, round(current * RESOLUTION.down));
	if (intervalMs < RESOLUTION.fastMs && current < cap)
		return Math.min(cap, round(current * RESOLUTION.up));
	return current;
}

const round = (n: number) => Math.round(n * 100) / 100;
