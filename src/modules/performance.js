"use strict";

module.exports = function(node) {

	let root = node.get_root();

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

	node = root.children[0];			// Possibly undefined.

	while (node) {

		for (let key of ["B", "W"]) {

			if (node.has_key(key)) {
				stats[key].moves++;
			}

			if (node.has_key(key) && node.has_valid_analysis() && node.parent.has_valid_analysis() && node.parent.get_board().active === key.toLowerCase()) {

				stats[key].moves_analysed++;

				let s = node.get(key);
				let gtp = node.get_board().gtp(s);

				let points_lost = node.parent.analysis.rootInfo.scoreLead - node.analysis.rootInfo.scoreLead;

				if (key === "W") {
					points_lost *= -1;
				}
				
				if (points_lost < 0) {
					points_lost = 0;
				}

				stats[key].points_lost += points_lost;

				let infos = node.parent.analysis.moveInfos.slice(0, 5);

				for (let info of infos) {
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
		}

		node = node.children[0];		// Possibly undefined.
	}

	// Normalise the stats by dividing by the number of moves analysed...

	for (let key of ["points_lost", "top1", "top5_raw", "top5_approved"]) {
		for (let bw of ["B", "W"]) {
			stats[bw][key] /= stats[bw].moves_analysed;
		}
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
