"use strict";

module.exports = function(any_node) {

	let root = any_node.get_root();

	let stats = {
		B: {
			name: root.get("PB") || "Unknown",
			moves: 0,
			moves_analysed: 0,
			points_lost: 0,
			top1: 0,
			top5_raw: 0,
			top5_approved: 0,
		},
		W: {
			name: root.get("PW") || "Unknown",
			moves: 0,
			moves_analysed: 0,
			points_lost: 0,
			top1: 0,
			top5_raw: 0,
			top5_approved: 0,
		},
	};

	let valid_nodes = [];

	for (let node = root; node; node = node.children[0]) {

		if (node.has_key("B")) stats["B"].moves++;
		if (node.has_key("W")) stats["W"].moves++;

		if (node.has_valid_analysis() && node.parent && node.parent.has_valid_analysis() && node.move_count() === 1) {
			if (node.has_key("B") && node.parent.get_board().active === "b") {
				valid_nodes.push(node);
			} else if (node.has_key("W") && node.parent.get_board().active === "w") {
				valid_nodes.push(node);
			}
		}
	}

	for (let node of valid_nodes) {

		let key = node.has_key("B") ? "B" : "W";		// We know it has one of these, from the move_count() test above.
		
		stats[key].moves_analysed++;

		let s = node.get(key);
		let gtp = node.get_board().gtp(s);

		let points_lost = node.parent.analysis.rootInfo.scoreLead - node.analysis.rootInfo.scoreLead;
		if (key === "W") points_lost *= -1;
		if (points_lost < 0) points_lost = 0;
		stats[key].points_lost += points_lost;

		for (let info of node.parent.analysis.moveInfos.slice(0, 5)) {
			if (info.move === gtp) {
				stats[key].top5_raw++;
				if (points_lost < 0.5 || info.order === 0) {
					stats[key].top5_approved++;
				}
				if (info.order === 0) {
					stats[key].top1++;
				}
				break;
			}
		}
	}

	// Normalise the stats by dividing by the number of moves analysed...

	for (let stat of ["points_lost", "top1", "top5_raw", "top5_approved"]) {
		stats["B"][stat] /= stats["B"].moves_analysed;
		stats["W"][stat] /= stats["W"].moves_analysed;
	}

	// Figure out who has the best stat for each type (to do colours later)...

	let winners = {};

	if (stats.B.points_lost < stats.W.points_lost) winners.points_lost = "B";
	if (stats.W.points_lost < stats.B.points_lost) winners.points_lost = "W";

	if (stats.B.top1 > stats.W.top1) winners.top1 = "B";
	if (stats.W.top1 > stats.B.top1) winners.top1 = "W";

	if (stats.B.top5_raw > stats.W.top5_raw) winners.top5_raw = "B";
	if (stats.W.top5_raw > stats.B.top5_raw) winners.top5_raw = "W";

	if (stats.B.top5_approved > stats.W.top5_approved) winners.top5_approved = "B";
	if (stats.W.top5_approved > stats.B.top5_approved) winners.top5_approved = "W";

	stats.winners = winners;
	return stats;
};
