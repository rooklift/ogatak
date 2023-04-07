"use strict";

module.exports = function(node) {

	let root = node.get_root();

	let stats = {
		B: {
			name: root.get("PB") || "Unknown",
			moves: 0,
			points_lost: 0,
			top5_raw: 0,
			top5_approved: 0,
		},
		W: {
			name: root.get("PW") || "Unknown",
			moves: 0,
			points_lost: 0,
			top5_raw: 0,
			top5_approved: 0,
		},
	};

	node = root.children[0];			// Possibly undefined.

	while (node) {

		for (let key of ["B", "W"]) {

			if (node.has_key(key) && node.has_valid_analysis() && node.parent.has_valid_analysis() && node.parent.get_board().active === key.toLowerCase()) {

				stats[key].moves++;

				let s = node.get(key);
				let gtp = node.get_board().gtp(s);

				let points_lost = node.parent.analysis.rootInfo.scoreLead - node.analysis.rootInfo.scoreLead;

				if (key === "W") {
					points_lost *= -1;
				}

				stats[key].points_lost += points_lost;

				let infos = node.parent.analysis.moveInfos.slice(0, 5);

				for (let info of infos) {
					if (info.move === gtp) {
						stats[key].top5_raw++;
						if (points_lost < 0.5 || info.order === 0) {
							stats[key].top5_approved++;
						}
						break;
					}
				}
			}
		}

		node = node.children[0];		// Possibly undefined.
	}

	return stats;
};
