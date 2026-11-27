import { Color } from 'three';

/**
 * The livery of the Lantern II, the Wick LR, Pad 7 and the Tracer. Hull greys are the ship's own; the accents follow the theme's
 * variables (a fork's `theme` override recolours the ship's violet and gold too), with
 * the brand values as fallbacks.
 */
export interface Palette {
	ground: Color;
	hull: Color;
	hullMid: Color;
	hullLower: Color;
	violet: Color;
	violetBright: Color;
	gold: Color;
	warning: Color;
	glass: Color;
	amber: Color;
	trim: Color;
	/** Dark metal: the Wick LR's rack, spare cell and winch drum. */
	metal: Color;
	/** On foot: the Crew Soft sleeve and the Tracer's slide (the theme's lightest ink). */
	sleeve: Color;
	/** On foot: gun metal, the frame (the theme's muted ink). */
	steel: Color;
	/** On foot: the glove, the deck tiles, the bay walls and dark glass, mixed from theme colours. */
	glove: Color;
	deck: Color;
	wall: Color;
	glassDark: Color;
}

export function readPalette(el?: Element | null): Palette {
	const css = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
	const read = (name: string, fallback: string) => {
		const value = css?.getPropertyValue(name).trim();
		try {
			return new Color(value || fallback);
		} catch {
			return new Color(fallback);
		}
	};
	const ground = read('--color-void', '#090B1C');
	const violet = read('--color-course-deep', '#6D6AF2');
	// The boards' deck #1A1C3A, wall #22254A, glove #2A2D55 and glass #0B0C22 aren't theme
	// tokens, so they are mixed from void, violet and the muted ink: a fork's re-theme
	// carries them along. The mixes land within a few levels of the boards' hexes.
	const steel = read('--color-ink-900', '#9396BA');
	const mix = (toViolet: number, toSteel: number) =>
		new Color(
			ground.r + (violet.r - ground.r) * toViolet + (steel.r - ground.r) * toSteel,
			ground.g + (violet.g - ground.g) * toViolet + (steel.g - ground.g) * toSteel,
			ground.b + (violet.b - ground.b) * toViolet + (steel.b - ground.b) * toSteel
		);
	return {
		ground,
		hull: new Color('#E6E8F6'),
		hullMid: new Color('#C9CCE4'),
		hullLower: new Color('#7C80A8'),
		violet,
		violetBright: read('--color-course', '#8B88FF'),
		gold: read('--color-trail', '#FFC21A'),
		warning: new Color('#FF9A7A'),
		glass: new Color('#10123A'),
		amber: new Color('#FFA62B'),
		trim: new Color('#2C2F5A'),
		metal: new Color('#3A3D66'),
		sleeve: read('--color-ink-200', '#E6E8F6'),
		steel,
		// Tuned to how Pistol3D renders the glove (a slate grey), not the raw #2A2D55.
		glove: mix(0.06, 0.3),
		deck: mix(0.08, 0.06),
		wall: mix(0.12, 0.1),
		glassDark: mix(0.03, 0)
	};
}
