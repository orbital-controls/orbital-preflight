/** Leave's copy, from the unsaved changes in every game loaded this visit (Main · Leave). */

interface GameChanges {
	sim: { name: string };
	changes: number;
}

export interface LeaveSummary {
	total: number;
	/** Games with changes. */
	games: number;
	body: string;
	/** "Export, then leave", or "Export all N games, then leave": one new file per game. */
	exportLabel: string;
}

export function leaveSummary(rows: readonly GameChanges[]): LeaveSummary {
	const changed = rows.filter((r) => r.changes > 0);
	const total = changed.reduce((sum, r) => sum + r.changes, 0);
	const list = changed.map((r) => `${r.changes} in ${r.sim.name}`).join(', ');
	return {
		total,
		games: changed.length,
		body: total
			? `You have ${total} unexported ${total === 1 ? 'change' : 'changes'} (${list}). Nothing is stored outside this tab, so they go if you leave.`
			: 'Nothing unsaved. Come back any time; your files stay on your machine.',
		exportLabel:
			changed.length > 1 ? `Export all ${changed.length} games, then leave` : 'Export, then leave'
	};
}
