"use strict";

exports.apply_komi_fix = function(root) {

	let km = parseFloat(root.get("KM"));

	if (Number.isNaN(km)) {
		root.delete_key("KM");
		return;
	}

	if (km > 150) {			// Fox, especially.
		km /= 100;
	}

	if (km - Math.floor(km) === 0.75 || km - Math.floor(km) === 0.25) {
		km *= 2;
	}

	root.set("KM", km);
};

exports.apply_pl_fix = function(root) {

	// In some ancient games, white plays first.
	// Add a PL property to the root if so.

	if (!root.has_key("B") && !root.has_key("W") && !root.has_key("PL") && root.children.length > 0) {

		// Don't do this when there's a single-colour setup (i.e. handicap) as it isn't needed...

		if ((root.has_key("AB") && root.has_key("AW")) || (!root.has_key("AB") && !root.has_key("AW"))) {

			let node = root.children[0];

			if (node.has_key("W") && !node.has_key("B")) {
				root.set("PL", "W");
			}
		}
	}
};

exports.apply_depth_1_ab_fix = function(root) {

	// For Fox, which places handicap stones at depth 1 rather than in the root.
	// Add a PL property at depth 1 (since node.natural_active() ignores AB outside of root).

	if (root.children.length === 0) {
		return;
	}

	let node1 = root.children[0];

	if (node1.children.length === 0) {
		return;
	}

	let node2 = node1.children[0];

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
