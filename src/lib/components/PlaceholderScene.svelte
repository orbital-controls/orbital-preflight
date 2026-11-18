<script lang="ts">
	import type { SceneProps } from '#lib/orbital-preflight/flight.ts';

	/**
	 * The 2D stand-in for the 3D scene, from the boards: a perspective grid with a
	 * wireframe ship, SRV or station corridor that reacts to the mock flight. The real
	 * scene implements the same props (`SceneProps`) and reports nothing back.
	 */
	interface Props extends SceneProps {
		/** First visit: the grid alone, nothing flying yet. */
		empty?: boolean;
	}

	let { flight: s, mode, empty = false }: Props = $props();

	const alt = $derived(s.altT > 0 ? (s.altDir > 0 ? 1.18 : 0.84) : 1);
	const ship = $derived({
		bank: s.rollT > 0 ? s.rollDir * 14 : 0,
		op: s.silent ? 0.45 : 1,
		glow: s.thr === 0 ? 0 : Math.round((4 + s.thr * 8 + (s.boostT > 0 ? 10 : 0)) * alt)
	});
	const sx = $derived(450 + (s.steerT > 0 ? s.steerDir * 34 : 0));
	const sy = $derived(430 + (s.jetT > 0 ? -34 : 0));
	const bob = $derived(s.walkT > 0 ? (s.walkT % 4 < 2 ? 4 : -4) : 0);
	const gap = $derived(s.aim ? 6 : s.walkT > 0 ? 18 : 12);
	const ln = $derived(s.aim ? 8 : 12);
	const camY = $derived((s.crouch ? -30 : 0) + (s.jumpT > 0 ? 24 : 0) + bob);
</script>

{#if mode === 'ship'}
	<svg
		width="900"
		height="560"
		viewBox="0 0 900 560"
		aria-hidden="true"
		class="absolute top-0 left-0"
	>
		<g stroke="var(--color-course)" stroke-width="1" opacity="0.28">
			<line x1="450" y1="260" x2="-300" y2="560" /><line x1="450" y1="260" x2="0" y2="560" /><line
				x1="450"
				y1="260"
				x2="225"
				y2="560"
			/>
			<line x1="450" y1="260" x2="450" y2="560" /><line x1="450" y1="260" x2="675" y2="560" /><line
				x1="450"
				y1="260"
				x2="900"
				y2="560"
			/><line x1="450" y1="260" x2="1200" y2="560" />
			<line x1="0" y1="300" x2="900" y2="300" /><line x1="0" y1="350" x2="900" y2="350" /><line
				x1="0"
				y1="425"
				x2="900"
				y2="425"
			/><line x1="0" y1="530" x2="900" y2="530" />
		</g>
		{#if !empty}
			<g
				transform="translate(450 340) rotate({ship.bank})"
				fill="none"
				stroke="var(--color-ink-200)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity={ship.op}
			>
				<path d="M-150 18 L-40 -6 L0 -34 L40 -6 L150 18 L40 22 L0 30 L-40 22 Z" />
				<path d="M-16 22 L-16 34 L16 34 L16 22" />
			</g>
			<circle cx="450" cy="368" r={ship.glow} fill="var(--color-trail)" opacity="0.55" />
			<g transform="translate(712 132)"
				><path
					d="M0 -9 L9 0 L0 9 L-9 0 Z"
					fill="none"
					stroke="var(--color-alert)"
					stroke-width="2"
				/></g
			>
		{/if}
	</svg>
{:else if mode === 'srv'}
	<svg
		width="900"
		height="560"
		viewBox="0 0 900 560"
		aria-hidden="true"
		class="absolute top-0 left-0"
	>
		<circle
			cx="170"
			cy="96"
			r="54"
			fill="none"
			stroke="var(--color-ink-200)"
			stroke-width="1.5"
			opacity="0.5"
		/>
		<ellipse
			cx="170"
			cy="96"
			rx="96"
			ry="18"
			transform="rotate(-14 170 96)"
			fill="none"
			stroke="var(--color-course)"
			stroke-width="1.5"
			stroke-dasharray="4 5"
			opacity="0.6"
		/>
		<path
			d="M0 250 Q120 205 240 238 T480 228 T720 248 T900 222 L900 560 L0 560 Z"
			fill="color-mix(in oklab, var(--color-course-deep) 7%, transparent)"
			stroke="var(--color-course)"
			stroke-width="1.5"
			opacity="0.7"
		/>
		<g stroke="var(--color-course)" stroke-width="1" opacity="0.25" fill="none">
			<line x1="450" y1="245" x2="-200" y2="560" /><line x1="450" y1="245" x2="150" y2="560" /><line
				x1="450"
				y1="245"
				x2="450"
				y2="560"
			/><line x1="450" y1="245" x2="750" y2="560" /><line x1="450" y1="245" x2="1100" y2="560" />
			<path d="M0 290 Q450 270 900 292" /><path d="M0 350 Q450 325 900 352" /><path
				d="M0 450 Q450 420 900 452"
			/>
		</g>
		<path
			d="M600 262 L640 236 L690 262 Z M90 300 L120 278 L160 302 Z"
			fill="none"
			stroke="var(--color-ink-900)"
			stroke-width="1.2"
			opacity="0.7"
		/>
		{#if s.sLights}<ellipse cx={sx} cy="300" rx="150" ry="30" fill="rgba(232,238,248,0.10)" />{/if}
		<g
			transform="translate({sx} {sy}) rotate({s.steerT > 0 ? s.steerDir * 5 : 0})"
			fill="none"
			stroke="var(--color-ink-200)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		>
			<path d="M-92 -10 L-72 -48 L72 -48 L92 -10 L92 22 L-92 22 Z" />
			<path d="M-40 -48 L-28 -76 L28 -76 L40 -48" />
			<rect x="-124" y="-14" width="30" height="48" /><rect x="94" y="-14" width="30" height="48" />
			{#if s.turret}<path
					d="M-10 -76 L-10 -90 L10 -90 L10 -76 M0 -90 L0 -128"
					stroke="var(--color-trail)"
					stroke-dasharray="0"
				/>{/if}
		</g>
		<circle
			cx={sx - 109}
			cy={sy + 40}
			r={s.jetT > 0 ? 12 : 0}
			fill="var(--color-trail)"
			opacity="0.6"
		/>
		<circle
			cx={sx + 109}
			cy={sy + 40}
			r={s.jetT > 0 ? 12 : 0}
			fill="var(--color-trail)"
			opacity="0.6"
		/>
		{#if s.fireT > 0}<line
				x1={sx}
				y1={sy - 128}
				x2="450"
				y2="250"
				stroke="var(--color-trail)"
				stroke-width="2.5"
			/>{/if}
		{#if s.fire2T > 0}<line
				x1={sx}
				y1={sy - 128}
				x2="450"
				y2="250"
				stroke="var(--color-alert)"
				stroke-width="5"
			/>{/if}
		{#if s.turret}
			<g stroke="var(--color-trail)" stroke-width="1.5" fill="none"
				><circle cx="450" cy="250" r="24" /><path
					d="M450 214 V234 M450 266 V286 M414 250 H434 M466 250 H486"
				/></g
			>
		{/if}
		<g transform="translate(712 214)"
			><path
				d="M0 -9 L9 0 L0 9 L-9 0 Z"
				fill="none"
				stroke="var(--color-alert)"
				stroke-width="2"
			/></g
		>
	</svg>
{:else}
	<svg
		width="900"
		height="560"
		viewBox="0 0 900 560"
		aria-hidden="true"
		class="absolute top-0 left-0 bg-abyss"
	>
		<g
			transform="translate(0 {camY})"
			fill="none"
			stroke="var(--color-course)"
			stroke-width="1.2"
			opacity="0.6"
		>
			<path d="M0 -40 L330 190 M900 -40 L570 190 M0 600 L330 370 M900 600 L570 370" />
			<rect x="330" y="190" width="240" height="180" />
			<path
				d="M110 113 L110 520 M200 175 L200 458 M790 113 L790 520 M700 175 L700 458"
				opacity="0.6"
			/>
			<path
				d="M0 600 L330 370 M120 600 L380 370 M300 600 L420 370 M600 600 L480 370 M780 600 L520 370"
				opacity="0.35"
			/>
			<rect
				x="410"
				y="250"
				width="80"
				height="120"
				stroke="var(--color-ink-200)"
				stroke-dasharray="4 4"
			/>
			<rect x="400" y="214" width="100" height="22" stroke="var(--color-trail)" />
			<text
				x="450"
				y="230"
				fill="var(--color-trail)"
				stroke="none"
				font-family="var(--font-mono)"
				font-size="11"
				text-anchor="middle"
				letter-spacing="1.5">[CONCOURSE]</text
			>
			<path d="M210 230 L290 262 L290 352 L210 392 Z" stroke="var(--color-ink-900)" />
		</g>
		{#if !s.holster}
			<g
				transform="translate({s.aim ? -180 : 0} {(s.aim ? -24 : 0) + bob})"
				fill="none"
				stroke="var(--color-ink-200)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			>
				<path d="M590 560 L632 470 L760 428 L802 446 L772 498 L700 520 L676 560 Z" />
				<path d="M700 470 L740 456" />
				{#if s.fireT > 0}<circle
						cx="790"
						cy="438"
						r="16"
						fill="var(--color-trail)"
						stroke="none"
						opacity="0.8"
					/>{/if}
			</g>
		{/if}
		<g stroke="var(--color-ink-200)" stroke-width="1.6">
			<line x1="450" y1={280 - gap - ln} x2="450" y2={280 - gap} />
			<line x1="450" y1={280 + gap} x2="450" y2={280 + gap + ln} />
			<line x1={450 - gap - ln} y1="280" x2={450 - gap} y2="280" />
			<line x1={450 + gap} y1="280" x2={450 + gap + ln} y2="280" />
		</g>
	</svg>
	{#if s.flash}
		<div
			class="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_200px_at_450px_280px,rgba(232,238,248,0.16),transparent_70%)]"
		></div>
	{/if}
{/if}
