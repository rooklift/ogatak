"use strict";

exports.apply_komi_fix = function(root) {

	let km = parseFloat(root.get("KM"));
	if (Number.isNaN(km)) {
		root.delete_key("KM");
		return;									// Just bail out if we weren't given a valid KM.
	}

	let ha = parseInt(root.get("HA"), 10);		// Might be NaN, we don't care.

	// Specific Fox fixes for the strangely common case where it specifies KM[0] and HA[0]
	// but there really was a komi...

	if (root.all_values("AP").includes("foxwq") && km === 0 && ha === 0) {
		if (["chinese", "cn"].includes(root.get("RU").toLowerCase())) {
			km = 7.5;
		} else {
			km = 6.5;
		}
	}

	// Some sources seem to multiply komi by 100...

	if (km > 150) {
		km /= 100;
	}

	// Some files give komi in Chinese format e.g. 3.75...

	if (km - Math.floor(km) === 0.75 || km - Math.floor(km) === 0.25) {
		km *= 2;
	}

	root.set("KM", km);
};

exports.apply_pl_fix = function(root) {

	// In some ancient games, white plays first.
	// Add a PL property to the root if so.

	if (root.children.length === 0) {
		return;
	}

	let node1 = root.children[0];

	if (!root.has_key("B") && !root.has_key("W") && !root.has_key("PL")) {
		if (root.has_key("AB") === root.has_key("AW")) {						// Only needed if there are no setup stones, or setup of both colours.
			if (node1.has_key("W") && !node1.has_key("B")) {
				root.set("PL", "W");
			}
		}
	}
};

exports.apply_depth_1_ab_fix = function(root) {

	// Some sources (e.g. Fox) might place handicap stones at depth 1 rather than in the root.
	// Add a PL property at depth 1 (since node.natural_active() ignores AB outside of root).
	// Note this isn't quite the same as the above since we only care if there's an AB tag in node1.

	if (root.children.length === 0 || root.children[0].children.length === 0) {
		return;
	}

	let node1 = root.children[0];
	let node2 = root.children[0].children[0];		// or node1.children[0]

	if (!root.has_key("B") && !root.has_key("W") && !root.has_key("AB") && !root.has_key("AW")) {
		if (node1.has_key("AB") && !node1.has_key("AW") && !node1.has_key("B") && !node1.has_key("W") && !node1.has_key("PL")) {
			if (node2.has_key("W") && !node2.has_key("B")) {
				node1.set("PL", "W");
			}
		}
	}
};

exports.apply_ruleset_guess = function(root) {
	if (!root.has_key("RU")) {
		if (root.get("KM").startsWith("7.5")) root.set("RU", "Chinese");
		if (root.get("KM").startsWith("6.5")) root.set("RU", "Japanese");
	}
};
