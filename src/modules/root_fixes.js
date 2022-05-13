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

	if (root.has_key("PL") || root.has_key("B") || root.has_key("W") || root.children.length === 0) {
		return;
	}

	let node = root.children[0];

	if (node.has_key("W") && !node.has_key("B")) {
		root.set("PL", "W");
	}
};

exports.apply_ruleset_guess = function(root) {
	if (!root.has_key("RU")) {
		if (root.get("KM").startsWith("7.5")) root.set("RU", "Chinese");
		if (root.get("KM").startsWith("6.5")) root.set("RU", "Japanese");
	}
};
