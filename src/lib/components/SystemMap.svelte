<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import {
		MAP_H,
		MAP_W,
		NO_DRIVE,
		PITCH_MAX,
		PITCH_MIN,
		project,
		scoopable,
		STAR_COLOURS,
		steer,
		systemById,
		type Vec3
	} from '#lib/orbital-preflight/galaxy.ts';
	import {
		arrival,
		bodiesOf,
		bodyIn,
		cursorBody,
		isGiant,
		layout,
		lsBetween,
		orreryOrbit,
		orreryPoint,
		orreryPos,
		pickBody,
		steerFlat,
		toScreen,
		toTarget,
		type Body,
		type SystemMapState
	} from '#lib/orbital-preflight/system.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';

	/**
	 * The system map over the viewport: the bodies of the system the ship is in, in Map
	 * mode (flat, what orbits what) or Orrery mode (where each body is on its orbit), the
	 * selected body's details and the target. The galaxy map's binds steer it through the
	 * app (`system.ts`); the mouse works it directly: drag to move (in the orrery, drag to
	 * turn and right-drag or Shift-drag to move), the wheel to zoom, click a body to
	 * select it. It sits outside the viewport's mouse zone, so a click here is never a
	 * mouse bind.
	 */
	const app = useOrbitalPreflight();
	const s = $derived(app.systemMap);
	const sys = $derived(systemById(s.system)!);
	const star = $derived(bodiesOf(s.system)[0]);
	const under = $derived(cursorBody(s));
	const shown = $derived(bodyIn(s.system, s.selected ?? under));
	const target = $derived(bodyIn(s.system, s.target));
	const left = $derived(toTarget(s));
	const shipAt = $derived(bodyIn(s.system, s.at));

	/** Bound map controls, for the legend: only those with a bind, and only ones this view uses. */
	const LEGEND: [label: string, ids: string[], orrery: boolean][] = [
		[
			'Move',
			[
				'CamTranslateForward',
				'CamTranslateLeft',
				'CamTranslateBackward',
				'CamTranslateRight',
				'CamTranslateYAxis',
				'CamTranslateXAxis'
			],
			false
		],
		['Turn', ['CamYawLeft', 'CamYawRight', 'CamYawAxis'], true],
		['Tilt', ['CamPitchUp', 'CamPitchDown', 'CamPitchAxis'], true],
		['Zoom', ['CamZoomIn', 'CamZoomOut', 'CamZoomAxis'], false],
		['Home', ['GalaxyMapHome'], false],
		['Select · target', ['UI_Select'], false],
		['Back', ['UI_Back'], false]
	];
	const legend = $derived(
		LEGEND.filter(([, , orrery]) => !orrery || s.view === 'orrery')
			.map(([label, ids]) => ({
				label,
				keys: ids.flatMap((id) => {
					const slot = app.store.bindings[id]?.[0];
					return slot ? [bindLabel(slot, app.roles)] : [];
				})
			}))
			.filter((row) => row.keys.length)
	);

	const closeKey = $derived.by(() => {
		const action = app.store.actionsIn(app.mode).find((a) => a.effect === 'sysmap');
		const slot = action ? app.store.bindings[action.id]?.[0] : null;
		return slot ? bindLabel(slot, app.roles) : null;
	});

	const listening = $derived(app.cap ? app.actionById(app.cap.target.actionId)?.name : null);
	const lastNames = $derived(app.lastActs.map((id) => app.actionById(id)?.name ?? id));

	function ls(n: number): string {
		if (n < 10) return `${n.toFixed(1)} ls`;
		return `${Math.round(n).toLocaleString('en-GB')} ls`;
	}

	function days(n: number): string {
		return n < 2 ? `${(n * 24).toFixed(1)} hours` : `${n.toLocaleString('en-GB')} days`;
	}

	/** The details panel's rows for a body, as the game's panel lists them. */
	function details(b: Body): [string, string][] {
		const from: [string, string] = [
			'Distance',
			b.id === s.at ? 'You are here' : ls(lsBetween(s.ship, b.pos))
		];
		if (b.kind === 'star')
			return [
				['Class', b.type],
				from,
				['Surface temp', `${b.temp.toLocaleString('en-GB')} K`],
				['Fuel scoop', scoopable(sys.star) ? 'Scoopable' : 'Not scoopable']
			];
		if (b.kind === 'station')
			return [
				['Type', b.type],
				from,
				['Orbits', bodyIn(s.system, b.parent)!.name],
				['Largest pad', b.pad === 'L' ? 'Large' : 'Medium'],
				['Economy', b.economy ?? 'None']
			];
		if (b.kind === 'belt' || b.kind === 'beacon')
			return [['Type', b.type], from, ['From arrival', ls(arrival(b))]];
		return [
			['Type', b.type],
			from,
			['From arrival', ls(arrival(b))],
			['Gravity', `${b.gravity.toFixed(2)} g`],
			['Surface temp', `${b.temp.toLocaleString('en-GB')} K`],
			['Atmosphere', b.atmosphere],
			['Landable', b.landable ? 'Yes' : 'No'],
			['Orbital period', days(b.period)],
			['Radius', `${b.radius.toLocaleString('en-GB')} km`]
		];
	}

	// Drawing.

	function colours(el: Element) {
		const css = getComputedStyle(el);
		const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
		return {
			void: read('--color-void', '#090B1C'),
			course: read('--color-course', '#8F8CFF'),
			trail: read('--color-trail', '#FFC21A'),
			ink: read('--color-ink-200', '#E6E8F6'),
			muted: read('--color-ink-900', '#9396BA')
		};
	}

	/** Planet colours by type: a hint of what each is, not the theme's. */
	const WORLD_COLOURS: [test: RegExp, colour: string][] = [
		[/^Metal-rich/, '#b9a68f'],
		[/^High metal/, '#a8836a'],
		[/^Rocky ice/, '#c9d4dc'],
		[/^Rocky/, '#9a8b7d'],
		[/^Icy/, '#dfeaf2'],
		[/^Earth-like/, '#5f9fd6'],
		[/^Water/, '#4f7fc8'],
		[/^Ammonia/, '#c8b46a'],
		[/^Class I /, '#d9c9a3'],
		[/^Class II /, '#e6e6e0'],
		[/^Class III/, '#c99a6b'],
		[/^Class IV/, '#a96c4f'],
		[/^Class V/, '#8a5e86']
	];

	function fill(b: Body): string {
		if (b.kind === 'star') return STAR_COLOURS[sys.star];
		return WORLD_COLOURS.find(([test]) => test.test(b.type))?.[1] ?? '#9a8b7d';
	}

	/** Landable bodies carry a light blue arc on their left side, as in the game. */
	const LANDABLE = '#7fd4ff';

	type Ctx = CanvasRenderingContext2D;

	/** A body's glyph at (x, y), radius r in screen pixels. */
	function glyph(
		ctx: Ctx,
		b: Body,
		x: number,
		y: number,
		r: number,
		c: ReturnType<typeof colours>
	) {
		ctx.globalAlpha = 1;
		if (b.kind === 'station') {
			ctx.fillStyle = c.ink;
			ctx.beginPath();
			ctx.moveTo(x, y - r);
			ctx.lineTo(x + r, y);
			ctx.lineTo(x, y + r);
			ctx.lineTo(x - r, y);
			ctx.closePath();
			ctx.fill();
			return;
		}
		if (b.kind === 'beacon') {
			ctx.fillStyle = c.course;
			ctx.beginPath();
			ctx.moveTo(x, y - r);
			ctx.lineTo(x + r, y + r);
			ctx.lineTo(x - r, y + r);
			ctx.closePath();
			ctx.fill();
			return;
		}
		if (b.kind === 'belt') {
			ctx.fillStyle = c.muted;
			for (let k = 0; k < 10; k++) {
				const a = (k / 10) * Math.PI * 2;
				ctx.beginPath();
				ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 1.4, 0, Math.PI * 2);
				ctx.fill();
			}
			return;
		}
		ctx.fillStyle = fill(b);
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		if (isGiant(b)) {
			// Bands, so a gas giant reads as one.
			ctx.globalAlpha = 0.25;
			ctx.fillStyle = c.void;
			ctx.fillRect(x - r * 0.9, y - r * 0.25, r * 1.8, r * 0.18);
			ctx.fillRect(x - r * 0.8, y + r * 0.3, r * 1.6, r * 0.14);
			ctx.globalAlpha = 1;
		}
		if (b.landable) {
			ctx.strokeStyle = LANDABLE;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(x, y, r + 3, Math.PI * 0.62, Math.PI * 1.38);
			ctx.stroke();
			ctx.lineWidth = 1;
		}
	}

	function marker(ctx: Ctx, x: number, y: number, size: number, colour: string, dash = false) {
		ctx.globalAlpha = 1;
		ctx.strokeStyle = colour;
		ctx.lineWidth = 1.5;
		ctx.setLineDash(dash ? [3, 3] : []);
		ctx.strokeRect(x - size, y - size, size * 2, size * 2);
		ctx.setLineDash([]);
		ctx.lineWidth = 1;
	}

	function label(ctx: Ctx, b: Body, x: number, y: number, c: ReturnType<typeof colours>) {
		const marked = b.id === s.selected || b.id === s.target || b.id === under;
		ctx.globalAlpha = marked ? 1 : 0.75;
		ctx.fillStyle = b.id === s.selected ? c.trail : marked ? c.ink : c.muted;
		ctx.fillText(b.name.toUpperCase(), x, y);
	}

	function drawMap(ctx: Ctx, st: SystemMapState, c: ReturnType<typeof colours>) {
		const placed = layout(st.system);
		const byId = new Map(placed.map((p) => [p.body.id, p]));
		const z = st.flat.zoom;
		const at = (x: number, y: number) => toScreen(st.flat, x, y);

		// The lines from each body to what it orbits: the row along, the columns down.
		ctx.strokeStyle = c.course;
		ctx.globalAlpha = 0.45;
		ctx.lineWidth = 1;
		for (const p of placed) {
			const parent = p.body.parent ? byId.get(p.body.parent) : undefined;
			if (!parent) continue;
			const a = at(parent.x, parent.y);
			const b = at(p.x, p.y);
			ctx.beginPath();
			if (p.y === 0 && parent.y === 0) {
				ctx.moveTo(a.x, a.y);
				ctx.lineTo(b.x, b.y);
			} else {
				ctx.moveTo(b.x, a.y);
				ctx.lineTo(b.x, b.y);
			}
			ctx.stroke();
		}

		ctx.font = '600 10px ui-monospace, monospace';
		ctx.textAlign = 'center';
		for (const p of placed) {
			const { x, y } = at(p.x, p.y);
			if (x < -60 || x > MAP_W + 60 || y < -60 || y > MAP_H + 60) continue;
			const r = Math.max(2.5, p.r * z);
			glyph(ctx, p.body, x, y, r, c);
			// Row bodies get their name and distance below; columns get them to the right.
			if (p.y === 0 && p.body.kind !== 'star') {
				label(ctx, p.body, x, y - r - 8, c);
				ctx.globalAlpha = 0.6;
				ctx.fillStyle = c.muted;
				ctx.fillText(ls(arrival(p.body)), x, y - r - 20);
			} else if (p.body.kind === 'star') {
				label(ctx, p.body, x, y - r - 10, c);
			} else {
				ctx.textAlign = 'left';
				label(ctx, p.body, x + r + 8, y + 4, c);
				ctx.textAlign = 'center';
			}
		}
		ctx.textAlign = 'left';

		const ring = (id: string | null, colour: string, extra: number, dash = false) => {
			const p = id ? byId.get(id) : undefined;
			if (!p) return;
			const { x, y } = at(p.x, p.y);
			marker(ctx, x, y, Math.max(2.5, p.r * z) + extra, colour, dash);
		};
		ring(st.at, c.course, 5);
		ring(under, c.ink, 8, true);
		ring(st.target, c.trail, 10, true);
		ring(st.selected, c.trail, 12);
	}

	function drawOrrery(ctx: Ctx, st: SystemMapState, c: ReturnType<typeof colours>) {
		const cam = st.cam;
		const at = (p: Vec3) => project(cam, p, MAP_W, MAP_H);
		const bodies = bodiesOf(st.system);
		const line = (points: Vec3[]) => {
			ctx.beginPath();
			let pen = false;
			for (const p of points) {
				const sp = at(p);
				if (!sp) {
					pen = false;
					continue;
				}
				if (pen) ctx.lineTo(sp.x, sp.y);
				else ctx.moveTo(sp.x, sp.y);
				pen = true;
			}
			ctx.stroke();
		};

		// Orbit lines: round the star, and round each planet for what orbits it.
		ctx.strokeStyle = c.course;
		ctx.lineWidth = 1;
		for (const b of bodies) {
			if (!b.parent || b.kind === 'beacon' || (b.kind === 'station' && b.orbit === 0)) continue;
			const centre = orreryPos(st.system, bodyIn(st.system, b.parent)!);
			const r = orreryOrbit(st.system, b);
			ctx.globalAlpha = b.kind === 'belt' ? 0.5 : 0.3;
			ctx.setLineDash(b.kind === 'belt' ? [2, 4] : []);
			line(
				Array.from({ length: 73 }, (_, k): Vec3 => {
					const a = (k / 72) * Math.PI * 2;
					return [centre[0] + Math.cos(a) * r, 0, centre[2] + Math.sin(a) * r];
				})
			);
		}
		ctx.setLineDash([]);

		const drawn = bodies
			.map((b) => ({ b, p: at(orreryPos(st.system, b)) }))
			.filter((v) => v.p)
			.sort((a, b) => b.p!.depth - a.p!.depth);
		ctx.font = '600 10px ui-monospace, monospace';
		for (const { b, p } of drawn) {
			const base =
				b.kind === 'star'
					? 9
					: isGiant(b)
						? 4.5
						: b.kind === 'planet'
							? 3
							: b.kind === 'belt'
								? 0
								: 1.8;
			// Icons, not to scale: about the same size whatever the zoom, smaller farther off.
			const r = Math.max(1.6, Math.min(26, (base * 1.8 * cam.dist) / p!.depth));
			if (b.kind === 'belt') continue;
			glyph(ctx, b, p!.x, p!.y, r, c);
			const near = b.kind === 'star' || b.kind === 'planet' || p!.depth < cam.dist * 0.6;
			if (near || b.id === st.selected || b.id === under || b.id === st.target)
				label(ctx, b, p!.x + r + 5, p!.y + 4, c);
		}

		// The ship, out in supercruise; at a body, the location marker shows it.
		const ship = st.at ? null : at(orreryPoint(st.ship));
		if (ship) {
			ctx.globalAlpha = 1;
			ctx.fillStyle = c.trail;
			ctx.beginPath();
			ctx.moveTo(ship.x, ship.y - 6);
			ctx.lineTo(ship.x + 5, ship.y + 5);
			ctx.lineTo(ship.x - 5, ship.y + 5);
			ctx.closePath();
			ctx.fill();
		}

		const ring = (id: string | null, colour: string, size: number, dash = false) => {
			const b = bodyIn(st.system, id);
			const p = b && at(orreryPos(st.system, b));
			if (p) marker(ctx, p.x, p.y, size, colour, dash);
		};
		ring(st.at, c.course, 10);
		ring(under, c.ink, 12, true);
		ring(st.target, c.trail, 13, true);
		ring(st.selected, c.trail, 15);
	}

	function draw(el: HTMLCanvasElement, st: SystemMapState) {
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		if (el.width !== MAP_W * ratio) {
			el.width = MAP_W * ratio;
			el.height = MAP_H * ratio;
		}
		const ctx = el.getContext('2d');
		if (!ctx) return;
		const c = colours(el);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.globalAlpha = 1;
		ctx.fillStyle = c.void;
		ctx.fillRect(0, 0, MAP_W, MAP_H);
		if (st.view === 'map') drawMap(ctx, st, c);
		else drawOrrery(ctx, st, c);

		// The cursor, at the centre.
		const x = MAP_W / 2;
		const y = MAP_H / 2;
		ctx.strokeStyle = c.trail;
		ctx.globalAlpha = 0.9;
		ctx.beginPath();
		for (const [dx, dy] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1]
		]) {
			ctx.moveTo(x + dx * 7, y + dy * 7);
			ctx.lineTo(x + dx * 18, y + dy * 18);
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	/** Paints the canvas, and again whenever the map's state changes. */
	function paint(el: HTMLCanvasElement) {
		draw(el, s);
	}

	// The mouse.

	let drag: { x: number; y: number; moved: number; pan: boolean; id: number } | null = null;

	function point(event: MouseEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * MAP_W,
			y: ((event.clientY - rect.top) / rect.height) * MAP_H
		};
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 && event.button !== 2) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = {
			x: event.clientX,
			y: event.clientY,
			moved: 0,
			pan: event.button === 2 || event.shiftKey,
			id: event.pointerId
		};
	}

	function onpointermove(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const dx = ((event.clientX - drag.x) / rect.width) * MAP_W;
		const dy = ((event.clientY - drag.y) / rect.height) * MAP_H;
		drag = { ...drag, x: event.clientX, y: event.clientY, moved: drag.moved + Math.hypot(dx, dy) };
		if (s.view === 'map') {
			// Drag the map along under the pointer.
			const z = s.flat.zoom;
			app.moveSystemMap({ ...s, flat: { ...s.flat, x: s.flat.x - dx / z, y: s.flat.y - dy / z } });
		} else if (drag.pan) {
			app.moveSystemMap({ ...s, cam: steer(s.cam, { ...NO_DRIVE, x: -dx / 360, y: dy / 360 }, 1) });
		} else {
			app.moveSystemMap({
				...s,
				cam: {
					...s.cam,
					yaw: s.cam.yaw - dx * 0.008,
					pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, s.cam.pitch + dy * 0.006))
				}
			});
		}
	}

	function onpointerup(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const click = drag.moved < 5;
		drag = null;
		if (!click) return;
		const { x, y } = point(event);
		const id = pickBody(s, x, y, 18);
		if (id) app.selectBody(id);
	}

	function onwheel(event: WheelEvent) {
		event.preventDefault();
		const drive = { ...NO_DRIVE, zoom: event.deltaY < 0 ? 1 : -1 };
		app.moveSystemMap(
			s.view === 'map'
				? { ...s, flat: steerFlat(s.system, s.flat, drive, 0.12) }
				: { ...s, cam: steer(s.cam, drive, 0.12) }
		);
	}

	/** Keys the map's binds use most, which would otherwise scroll the page. */
	const SCROLL_KEYS = new Set([
		'Space',
		'ArrowUp',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'PageUp',
		'PageDown',
		'Home',
		'End'
	]);

	function onkeydown(event: KeyboardEvent) {
		if (app.cap || app.blocked) return;
		if (event.code === 'Escape') app.closeSystemMap();
		const el = event.target as HTMLElement | null;
		if (SCROLL_KEYS.has(event.code) && !el?.closest?.('button, a, input, textarea, select'))
			event.preventDefault();
	}

	const summary = $derived(
		`System map of ${sys.name}, ${s.view === 'map' ? 'Map mode' : 'Orrery mode'}: ` +
			`${bodiesOf(s.system).filter((b) => b.kind === 'planet').length} planets.` +
			(shown
				? ` ${shown.id === s.selected ? 'Selected' : 'Under the cursor'}: ${shown.name}, ${shown.type}.`
				: '') +
			(target && left !== null ? ` Target: ${target.name}, ${ls(left)}.` : '')
	);

	const VIEWS = [
		['map', 'Map'],
		['orrery', 'Orrery']
	] as const;
</script>

<svelte:window {onkeydown} />

<section
	aria-labelledby="system-map-title"
	class="absolute inset-0 overflow-hidden border border-course/25 bg-void notch-card"
	data-op-system-map
>
	<canvas
		{@attach paint}
		aria-hidden="true"
		class="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={() => (drag = null)}
		{onwheel}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	<p class="sr-only">{summary}</p>
	<div class="absolute top-4 left-[18px] flex flex-col gap-[2px]">
		<h2 id="system-map-title" class="op-lbl text-trail">System map</h2>
		<span class="op-hud"
			>{sys.name} · <span class="text-ink-200">{shipAt ? shipAt.name : 'Supercruise'}</span></span
		>
	</div>

	<div class="absolute top-4 right-4 flex items-center gap-2">
		{#if listening}
			<span class="pulse border border-trail px-[10px] py-[5px] op-hud text-trail notch op-notch-xs"
				>● Listening · {listening}</span
			>
		{/if}
		{#if lastNames.length}
			<span class="op-hud"
				>Last input · <span class="text-ink-200">{lastNames.join(', ')}</span></span
			>
		{/if}
		<div role="group" aria-label="View" class="flex">
			{#each VIEWS as [view, name] (view)}
				<button
					type="button"
					aria-pressed={s.view === view}
					onclick={() => app.setSystemView(view)}
					class="border border-course/40 bg-abyss/70 px-[10px] py-[5px] font-mono text-[11px] font-bold tracking-[.1em] text-ink-500 uppercase hover:border-course aria-pressed:border-trail aria-pressed:text-trail"
					>{name}</button
				>
			{/each}
		</div>
		<button
			type="button"
			onclick={() => app.closeSystemMap()}
			class="border border-course/40 bg-abyss/70 px-[10px] py-[5px] font-mono text-[11px] font-bold tracking-[.1em] text-ink-500 uppercase notch op-notch-xs hover:border-course"
			>Close map{#if closeKey}<span class="text-ink-900"> · {closeKey}</span>{/if}</button
		>
	</div>

	<aside
		aria-label="Body"
		class="absolute top-[72px] left-[18px] flex w-[250px] flex-col gap-3 px-[14px] py-3 glass notch op-notch-xs"
	>
		{#if shown}
			<div class="flex flex-col gap-[2px]">
				<span class="op-hud">{shown.id === s.selected ? 'Selected' : 'Under the cursor'}</span>
				<h3 class="font-display text-[22px] leading-none font-extrabold uppercase">
					{shown.name}
				</h3>
			</div>
			<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px]">
				{#each details(shown) as [name, value] (name)}
					<dt class="text-ink-900">{name}</dt>
					<dd>{value}</dd>
				{/each}
			</dl>
			{#if shown.id !== s.selected}
				<button
					type="button"
					onclick={() => app.selectBody(shown.id)}
					class="border border-course/50 px-3 py-[6px] text-left text-[13px] font-semibold notch op-notch-xs hover:border-course"
					>Select {shown.name}</button
				>
			{:else if shown.id !== s.at && shown.id !== s.target}
				<button
					type="button"
					onclick={() => app.targetBody()}
					class="border border-trail bg-trail px-3 py-[6px] text-left text-[13px] font-semibold text-void notch op-notch-xs"
					>Target</button
				>
			{/if}
		{:else}
			<p class="text-[13px] text-ink-500">
				Move the cursor onto a body, or click one, to see it here.
			</p>
		{/if}

		{#if target && left !== null}
			<div class="flex flex-col gap-1 border-t border-course/25 pt-3">
				<span class="op-hud"
					>Target · <span class="text-trail">{target.name}</span> · {ls(left)}</span
				>
				<span class="text-[12px] text-ink-500"
					>Engage supercruise with throttle up to close on it, and drop out when it's near.</span
				>
				<button
					type="button"
					onclick={() => app.clearTarget()}
					class="self-start text-[12px] text-ink-900 underline hover:text-ink-200"
					>Clear target</button
				>
			</div>
		{/if}
	</aside>

	{#if app.flight.msgT > 0}
		<div class="pointer-events-none absolute top-[210px] right-0 left-0 flex justify-center">
			<span
				class="border-y border-trail bg-void/70 px-[22px] py-[10px] font-mono text-[18px] font-semibold tracking-[.14em] text-trail uppercase"
				>{app.flight.msg}</span
			>
		</div>
	{/if}

	<ul
		aria-label="Map controls"
		class="pointer-events-none absolute right-4 bottom-3 left-[290px] flex flex-wrap justify-end gap-x-4 gap-y-1 font-mono text-[11px]"
	>
		{#each legend as row (row.label)}
			<li class="flex items-center gap-[6px]">
				{#each row.keys as key (key)}
					<span class="bg-ink-200/90 px-[6px] py-[1px] font-bold text-void notch op-notch-xs"
						>{key}</span
					>
				{/each}
				<span class="text-ink-500">{row.label}</span>
			</li>
		{/each}
		<li class="flex items-center gap-[6px]">
			<span class="border border-ink-900/50 px-[6px] text-ink-200 notch op-notch-xs">Mouse</span>
			<span class="text-ink-500"
				>{s.view === 'map'
					? 'Drag to move · wheel · click'
					: 'Drag to turn · right-drag to move · wheel · click'}</span
			>
		</li>
		<li class="flex items-center gap-[6px]">
			<span
				class="inline-block h-[10px] w-[5px] rounded-l-full border-l-2"
				style:border-color={LANDABLE}
			></span>
			<span class="text-ink-500">Landable</span>
		</li>
	</ul>

	<span class="pointer-events-none absolute bottom-4 left-[18px] op-hud"
		>Star · <span class="text-ink-200">{star.type}</span></span
	>
</section>
