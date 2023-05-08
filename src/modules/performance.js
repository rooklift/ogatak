"use strict";

// Here we implement (with permission) some of KaTrain's performance statistics.
// By far the hardest part to understand is the accuracy statistic.

const {clamp, sum} = require("./utils");

module.exports = function(any_node) {

	let root = any_node.get_root();

	let stats = {
		B: {name: root.get("PB") || "Unknown"},
		W: {name: root.get("PW") || "Unknown"},
	};
	for (let key of ["B", "W"]) {
		Object.assign(stats[key], {
			moves: 0,
			moves_analysed: 0,
			accuracy: 0,
			points_lost: 0,
			points_lost_adjusted_sum: 0,
			weights_adjusted_sum: 0,
			top1: 0,
			top5_approved: 0,
		});
	}

	// --------------------------------------------------------------------------------------------

	let main_line = [];
	for (let node = root; node; node = node.children[0]) {
		if (node.has_key("B")) stats["B"].moves++;
		if (node.has_key("W")) stats["W"].moves++;
		main_line.push(node);
	}
	let valid_nodes = main_line.filter(node => valid_node_to_analyse(node));

	// --------------------------------------------------------------------------------------------

	for (let node of valid_nodes) {

		let key = node.has_key("B") ? "B" : "W";		// We know it has one of these, from the move_count() test above.

		stats[key].moves_analysed++;

		let s = node.get(key);
		let gtp = node.get_board().gtp(s);

		let points_lost = node.parent.analysis.rootInfo.scoreLead - node.analysis.rootInfo.scoreLead;
		if (key === "W") points_lost *= -1;
		if (points_lost < 0) points_lost = 0;
		stats[key].points_lost += points_lost;

		let parent_difficulty_stat = node_difficulty_stat(node.parent);
		let parent_moveinfo_prior_sum = sum(node.parent.analysis.moveInfos.map(info => info.prior));

		let weight = clamp(0, parent_difficulty_stat / parent_moveinfo_prior_sum, 1.0);
		let weight_adjusted = clamp(0.05, Math.max(weight, points_lost / 4), 1.0);

		stats[key].weights_adjusted_sum += weight_adjusted;
		stats[key].points_lost_adjusted_sum += points_lost * weight_adjusted;

		for (let info of node.parent.analysis.moveInfos.slice(0, 5)) {
			if (info.move === gtp) {
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

	// --------------------------------------------------------------------------------------------

	for (let key of ["B", "W"]) {
		let wt_loss = stats[key].points_lost_adjusted_sum / stats[key].weights_adjusted_sum;
		stats[key].accuracy = 100 * Math.pow(0.75, wt_loss);
	}

	stats.winners = declare_winners(stats);

	return stats;
};


function valid_node_to_analyse(node) {
	if (node && node.has_valid_analysis() && node.parent && node.parent.has_valid_analysis() && node.move_count() === 1) {
		if (node.has_key("B") && node.parent.get_board().active === "b") {
			return true;
		} else if (node.has_key("W") && node.parent.get_board().active === "w") {
			return true;
		}
	}
	return false;
}


function node_difficulty_stat(node) {		// Assumes it has valid analysis.

	// KaTrain calculates some sort of difficulty statistic for a position by looking at the known moveInfos and
	// multiplying the points lost for each by the prior. Then these values are summed...

	let ret = 0;

	for (let info of node.analysis.moveInfos) {

		let move_points_lost = node.analysis.rootInfo.scoreLead - info.scoreLead;
		if (node.get_board().active === "w") move_points_lost *= -1;
		if (move_points_lost < 0) move_points_lost = 0;

		ret += move_points_lost * info.prior;
	}

	return ret;
}


function declare_winners(stats) {

	let winners = {};

	if (stats.B.accuracy > stats.W.accuracy) {
		winners.accuracy = "B";
	}
	if (stats.W.accuracy > stats.B.accuracy) {
		winners.accuracy = "W";
	}
	if (stats.B.points_lost / stats.B.moves_analysed < stats.W.points_lost / stats.W.moves_analysed) {
		winners.points_lost = "B";
	}
	if (stats.W.points_lost / stats.W.moves_analysed < stats.B.points_lost / stats.B.moves_analysed) {
		winners.points_lost = "W";
	}
	if (stats.B.top1 / stats.B.moves_analysed > stats.W.top1 / stats.W.moves_analysed) {
		winners.top1 = "B";
	}
	if (stats.W.top1 / stats.W.moves_analysed > stats.B.top1 / stats.B.moves_analysed) {
		winners.top1 = "W";
	}
	if (stats.B.top5_approved / stats.B.moves_analysed > stats.W.top5_approved / stats.W.moves_analysed) {
		winners.top5_approved = "B";
	}
	if (stats.W.top5_approved / stats.W.moves_analysed > stats.B.top5_approved / stats.B.moves_analysed) {
		winners.top5_approved = "W";
	}

	return winners;
}
