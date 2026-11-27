<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import {
		cursorSystem,
		distance,
		JUMP_RANGE,
		MAP_H,
		MAP_W,
		NO_DRIVE,
		PITCH_MAX,
		PITCH_MIN,
		pickAt,
		project,
		routeLength,
		scoopable,
		STAR_COLOURS,
		STAR_NAMES,
		steer,
		SYSTEMS,
		systemById,
		type MapCamera,
		type Vec3
	} from '#lib/orbital-preflight/galaxy.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';

	/**
	 * The galaxy map over the viewport: a canvas of the pocket's systems, the selected
	 * system's panel and the route. Its binds steer it through the app (`galaxy.ts`); the
	 * mouse works it directly, as in the game: drag to turn, right-drag or Shift-drag to
	 * move, the wheel to zoom, click a system to select it. It sits outside the viewport's
	 * mouse zone, so a click here is never a mouse bind.
	 */
	const app = useOrbitalPreflight();
	const g = $derived(app.galaxy);
	const here = $derived(systemById(g.location)!);
	const under = $derived(cursorSystem(g.cam));
	const shown = $derived(systemById(g.selected ?? under));
	const route = $derived(routeLength(g.location, g.route));
	const target = $derived(systemById(g.target));

	/** Bound map controls, for the legend: only those with a bind. */
	const LEGEND: [label: string, ids: string[]][] = [
		[
			'Move',
			[
				'CamTranslateForward',
				'CamTranslateLeft',
				'CamTranslateBackward',
				'CamTranslateRight',
				'CamTranslateYAxis',
				'CamTranslateXAxis'
			]
		],
		['Up / down', ['CamTranslateUp', 'CamTranslateDown', 'CamTranslateZAxis', 'CamTranslateZHold']],
		['Turn', ['CamYawLeft', 'CamYawRight', 'CamYawAxis']],
		['Tilt', ['CamPitchUp', 'CamPitchDown', 'CamPitchAxis']],
		['Zoom', ['CamZoomIn', 'CamZoomOut', 'CamZoomAxis']],
		['Home', ['GalaxyMapHome']],
		['Select · plot', ['UI_Select']],
		['Back', ['UI_Back']]
	];
	const legend = $derived(
		LEGEND.map(([label, ids]) => ({
			label,
			keys: ids.flatMap((id) => {
				const slot = app.store.bindings[id]?.[0];
				return slot ? [bindLabel(slot, app.roles)] : [];
			})
		})).filter((row) => row.keys.length)
	);

	const closeKey = $derived.by(() => {
		const action = app.store.actionsIn(app.mode).find((a) => a.effect === 'galmap');
		const slot = action ? app.store.bindings[action.id]?.[0] : null;
		return slot ? bindLabel(slot, app.roles) : null;
	});

	const listening = $derived(app.cap ? app.actionById(app.cap.target.actionId)?.name : null);
	const lastNames = $derived(app.lastActs.map((id) => app.actionById(id)?.name ?? id));

	function ly(n: number): string {
		return `${n.toFixed(1)} ly`;
	}

	function people(n: number): string {
		if (!n) return 'Uninhabited';
		if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
		if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
		return n.toLocaleString('en-GB');
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

	function draw(el: HTMLCanvasElement, cam: MapCamera) {
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		if (el.width !== MAP_W * ratio) {
			el.width = MAP_W * ratio;
			el.height = MAP_H * ratio;
		}
		const ctx = el.getContext('2d');
		if (!ctx) return;
		const c = colours(el);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.fillStyle = c.void;
		ctx.fillRect(0, 0, MAP_W, MAP_H);
		const at = (p: Vec3) => project(cam, p, MAP_W, MAP_H);
		const line = (points: Vec3[]) => {
			ctx.beginPath();
			let pen = false;
			for (const p of points) {
				const s = at(p);
				if (!s) {
					pen = false;
					continue;
				}
				if (pen) ctx.lineTo(s.x, s.y);
				else ctx.moveTo(s.x, s.y);
				pen = true;
			}
			ctx.stroke();
		};

		// The galactic plane: a grid every 10 ly, in short pieces so perspective bends it.
		ctx.strokeStyle = c.course;
		ctx.lineWidth = 1;
		for (let i = -60; i <= 60; i += 10) {
			ctx.globalAlpha = i === 0 ? 0.32 : 0.14;
			const run = Array.from({ length: 25 }, (_, k) => -60 + k * 5);
			line(run.map((v): Vec3 => [i, 0, v]));
			line(run.map((v): Vec3 => [v, 0, i]));
		}

		// The jump range ring round the ship's system, at its height.
		const home = here.pos;
		ctx.globalAlpha = 0.55;
		ctx.setLineDash([4, 5]);
		line(
			Array.from({ length: 65 }, (_, k): Vec3 => {
				const a = (k / 64) * Math.PI * 2;
				return [home[0] + Math.cos(a) * JUMP_RANGE, home[1], home[2] + Math.sin(a) * JUMP_RANGE];
			})
		);
		ctx.setLineDash([]);

		// Stars, far ones first, each with a drop line to the plane.
		const stars = SYSTEMS.map((s) => ({ s, p: at(s.pos) }))
			.filter((v) => v.p)
			.sort((a, b) => b.p!.depth - a.p!.depth);
		for (const { s } of stars) {
			ctx.globalAlpha = 0.22;
			ctx.strokeStyle = c.muted;
			line([s.pos, [s.pos[0], 0, s.pos[2]]]);
		}

		// The route, in the trail colour.
		if (g.route.length) {
			ctx.globalAlpha = 0.95;
			ctx.strokeStyle = c.trail;
			ctx.lineWidth = 2.5;
			line([home, ...g.route.map((id) => systemById(id)!.pos)]);
			ctx.lineWidth = 1;
		}

		ctx.font = '600 11px ui-monospace, monospace';
		for (const { s, p } of stars) {
			const r = Math.max(
				1.6,
				Math.min(6, (s.star === 'O' || s.star === 'B' ? 220 : 150) / p!.depth)
			);
			ctx.globalAlpha = 1;
			ctx.fillStyle = STAR_COLOURS[s.star];
			ctx.beginPath();
			ctx.arc(p!.x, p!.y, r, 0, Math.PI * 2);
			ctx.fill();
			const marked =
				s.id === g.location || s.id === g.selected || s.id === under || g.route.includes(s.id);
			// Every name near the cursor; farther out only the ones that matter now.
			if (marked || p!.depth < cam.dist + 12) {
				ctx.globalAlpha = marked ? 1 : 0.7;
				ctx.fillStyle = s.id === g.selected ? c.trail : marked ? c.ink : c.muted;
				ctx.fillText(s.name.toUpperCase(), p!.x + r + 5, p!.y + 4);
			}
		}

		// Markers: where the ship is, the selection, the system under the cursor.
		ctx.globalAlpha = 1;
		const ring = (id: string | null, colour: string, size: number, dash = false) => {
			const s = systemById(id);
			const p = s && at(s.pos);
			if (!p) return;
			ctx.strokeStyle = colour;
			ctx.lineWidth = 1.5;
			ctx.setLineDash(dash ? [3, 3] : []);
			ctx.strokeRect(p.x - size, p.y - size, size * 2, size * 2);
			ctx.setLineDash([]);
		};
		ring(g.location, c.course, 9);
		ring(under, c.ink, 12, true);
		ring(g.selected, c.trail, 14);

		// The cursor: the focus, with its stem down to the plane.
		const f = cam.focus;
		ctx.strokeStyle = c.trail;
		ctx.globalAlpha = 0.5;
		line([f, [f[0], 0, f[2]]]);
		const fp = at(f);
		if (fp) {
			ctx.globalAlpha = 0.9;
			ctx.beginPath();
			ctx.moveTo(fp.x - 18, fp.y);
			ctx.lineTo(fp.x - 7, fp.y);
			ctx.moveTo(fp.x + 7, fp.y);
			ctx.lineTo(fp.x + 18, fp.y);
			ctx.moveTo(fp.x, fp.y - 18);
			ctx.lineTo(fp.x, fp.y - 7);
			ctx.moveTo(fp.x, fp.y + 7);
			ctx.lineTo(fp.x, fp.y + 18);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	/** Paints the canvas, and again whenever the map's state changes. */
	function paint(el: HTMLCanvasElement) {
		draw(el, g.cam);
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
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		drag = { ...drag, x: event.clientX, y: event.clientY, moved: drag.moved + Math.hypot(dx, dy) };
		const cam = g.cam;
		if (drag.pan) {
			// Drag the plane along under the pointer. At the focus a pixel is dist / 600 ly
			// (the map's focal length), and `steer` moves dist × 0.6 a second per unit.
			app.moveMap(steer(cam, { ...NO_DRIVE, x: -dx / 360, y: dy / 360 }, 1));
		} else {
			app.moveMap({
				...cam,
				yaw: cam.yaw - dx * 0.008,
				pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch + dy * 0.006))
			});
		}
	}

	function onpointerup(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const click = drag.moved < 5 && !drag.pan;
		drag = null;
		if (!click) return;
		const { x, y } = point(event);
		const id = pickAt(g.cam, x, y, MAP_W, MAP_H, 16);
		if (id) app.selectSystem(id);
	}

	function onwheel(event: WheelEvent) {
		event.preventDefault();
		app.moveMap(steer(g.cam, { ...NO_DRIVE, zoom: event.deltaY < 0 ? 1 : -1 }, 0.12));
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
		if (event.code === 'Escape') app.closeMap();
		// Space on a focused button still presses it.
		const el = event.target as HTMLElement | null;
		if (SCROLL_KEYS.has(event.code) && !el?.closest?.('button, a, input, textarea, select'))
			event.preventDefault();
	}

	const label = $derived(
		`Galaxy map. You are at ${here.name}.` +
			(shown
				? ` ${g.selected ? 'Selected' : 'Under the cursor'}: ${shown.name}, ${ly(distance(here.pos, shown.pos))} away.`
				: '') +
			(g.route.length ? ` Route: ${route.jumps} jumps, ${ly(route.ly)}.` : '')
	);
</script>

<svelte:window {onkeydown} />

<section
	aria-labelledby="galaxy-map-title"
	class="absolute inset-0 overflow-hidden border border-course/25 bg-void notch-card"
	data-op-galaxy-map
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

	<p class="sr-only">{label}</p>
	<div class="absolute top-4 left-[18px] flex flex-col gap-[2px]">
		<h2 id="galaxy-map-title" class="op-lbl text-trail">Galaxy map</h2>
		<span class="op-hud">Location · <span class="text-ink-200">{here.name}</span></span>
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
		<button
			type="button"
			onclick={() => app.closeMap()}
			class="border border-course/40 bg-abyss/70 px-[10px] py-[5px] font-mono text-[11px] font-bold tracking-[.1em] text-ink-500 uppercase notch op-notch-xs hover:border-course"
			>Close map{#if closeKey}<span class="text-ink-900"> · {closeKey}</span>{/if}</button
		>
	</div>

	<aside
		aria-label="System"
		class="absolute top-[72px] left-[18px] flex w-[240px] flex-col gap-3 px-[14px] py-3 glass notch op-notch-xs"
	>
		{#if shown}
			<div class="flex flex-col gap-[2px]">
				<span class="op-hud">{shown.id === g.selected ? 'Selected' : 'Under the cursor'}</span>
				<h3 class="font-display text-[24px] leading-none font-extrabold uppercase">{shown.name}</h3>
			</div>
			<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px]">
				<dt class="text-ink-900">Distance</dt>
				<dd>{shown.id === g.location ? 'You are here' : ly(distance(here.pos, shown.pos))}</dd>
				<dt class="text-ink-900">Star</dt>
				<dd>{STAR_NAMES[shown.star]}</dd>
				<dt class="text-ink-900">Fuel scoop</dt>
				<dd>{scoopable(shown.star) ? 'Scoopable' : 'Not scoopable'}</dd>
				<dt class="text-ink-900">Economy</dt>
				<dd>{shown.economy}</dd>
				<dt class="text-ink-900">Population</dt>
				<dd>{people(shown.population)}</dd>
			</dl>
			{#if shown.id !== g.selected}
				<button
					type="button"
					onclick={() => app.selectSystem(shown.id)}
					class="border border-course/50 px-3 py-[6px] text-left text-[13px] font-semibold notch op-notch-xs hover:border-course"
					>Select {shown.name}</button
				>
			{:else if shown.id !== g.location && g.route.at(-1) !== shown.id}
				<button
					type="button"
					onclick={() => app.plotRoute()}
					class="border border-trail bg-trail px-3 py-[6px] text-left text-[13px] font-semibold text-void notch op-notch-xs"
					>Plot route</button
				>
			{/if}
		{:else}
			<p class="text-[13px] text-ink-500">
				Move the cursor onto a system, or click one, to see it here.
			</p>
		{/if}

		{#if g.route.length}
			<div class="flex flex-col gap-1 border-t border-course/25 pt-3">
				<span class="op-hud"
					>Route · {route.jumps} {route.jumps === 1 ? 'jump' : 'jumps'} · {ly(route.ly)}</span
				>
				<ol class="flex flex-col gap-[2px] font-mono text-[12px]">
					{#each g.route as id, i (id)}
						{@const s = systemById(id)!}
						<li class={id === g.target ? 'text-trail' : 'text-ink-500'}>
							{i + 1}. {s.name}{#if !scoopable(s.star)}<span class="text-ink-900">
									· no scoop</span
								>{/if}
						</li>
					{/each}
				</ol>
				<button
					type="button"
					onclick={() => app.clearRoute()}
					class="self-start text-[12px] text-ink-900 underline hover:text-ink-200"
					>Clear route</button
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
		class="pointer-events-none absolute right-4 bottom-3 left-[280px] flex flex-wrap justify-end gap-x-4 gap-y-1 font-mono text-[11px]"
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
			<span class="text-ink-500">Drag to turn · right-drag to move · wheel · click</span>
		</li>
	</ul>

	{#if target}
		<span class="pointer-events-none absolute bottom-4 left-[18px] op-hud"
			>Target · <span class="text-trail">{target.name}</span>{#if g.chargeT > 0}
				· charging{/if}</span
		>
	{/if}
</section>
