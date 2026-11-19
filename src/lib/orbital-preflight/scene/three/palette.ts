import { Color } from 'three';

/**
 * The livery of the Lantern II and the Wick LR. Hull greys are the ship's own; the accents follow the theme's
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
	return {
		ground: read('--color-void', '#090B1C'),
		hull: new Color('#E6E8F6'),
		hullMid: new Color('#C9CCE4'),
		hullLower: new Color('#7C80A8'),
		violet: read('--color-course-deep', '#6D6AF2'),
		violetBright: read('--color-course', '#8B88FF'),
		gold: read('--color-trail', '#FFC21A'),
		warning: new Color('#FF9A7A'),
		glass: new Color('#10123A'),
		amber: new Color('#FFA62B'),
		trim: new Color('#2C2F5A'),
		metal: new Color('#3A3D66')
	};
}
