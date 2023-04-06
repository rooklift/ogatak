"use strict";

exports.apply_komi_fix = function(root) {

	let km = parseFloat(root.get("KM"));
	if (Number.isNaN(km)) {
		root.delete_key("KM");
		return;									// Just bail out if we weren't given a valid KM.
	}

	let ha = parseInt(root.get("HA"), 10);		// Might be NaN, we don't care.

	// Specific Fox fixes for the strangely common case where it specifies KM[0] and HA[0]
	// but there really was a komi... I believe Fox specifies HA[1] if there's genuinely
	// no komi, so the following is "safe" I think...

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

	// Find the node with the first real move (B or W tag).
	// If it's not made by the natural player -- as defined by node.natural_active() -- then set a PL tag in its parent.

	let node = root;

	if (node.has_key("B") || node.has_key("W")) {
		return;
	}

	while (true) {
		if (node.children.length === 0) {
			return;
		}
		node = node.children[0];
		if (node.has_key("B")) {
			if (node.parent.natural_active() !== "b") {
				node.parent.set("PL", "B");
			}
			return;
		}
		if (node.has_key("W")) {
			if (node.parent.natural_active() !== "w") {
				node.parent.set("PL", "W");
			}
			return;
		}
	}
};

exports.apply_ruleset_guess = function(root) {
	if (!root.has_key("RU")) {
		if (root.get("KM").startsWith("7.5")) root.set("RU", "Chinese");
		if (root.get("KM").startsWith("6.5")) root.set("RU", "Japanese");
	}
};
