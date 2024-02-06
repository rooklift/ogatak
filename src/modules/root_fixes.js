"use strict";

const {replace_all} = require("./utils");

function apply_komi_fix(root) {

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
}

function apply_pl_fix(root) {

	// Find the node with the first real move (B or W tag).
	// If it's not made by the natural player -- as defined by node.natural_active() -- then set a PL tag in its parent.

	let node = root;

	while (node) {
		if (node.has_key("B")) {
			if (node.parent && node.parent.natural_active() !== "b") {
				node.parent.set("PL", "B");
			}
			return;
		}
		if (node.has_key("W")) {
			if (node.parent && node.parent.natural_active() !== "w") {
				node.parent.set("PL", "W");
			}
			return;
		}
		node = node.children[0];		// Possibly undefined.
	}
}

function apply_ruleset_fixes(root) {
	if (!root.has_key("RU")) {
		return;
	}
	let rules = root.get("RU");
	rules = replace_all(rules, "\r\n", " ");						// Unlikely, but if these ever
	rules = replace_all(rules, "\n", " ");							// existed they would mess up
	rules = replace_all(rules, "\r", " ");							// the infobox very badly...
	if (["chinese", "japanese", "korean"].includes(rules)) {
		rules = rules[0].toUpperCase() + rules.slice(1);
	}
	root.set("RU", rules);
}

function apply_ruleset_guess(root) {
	if (!root.has_key("RU")) {
		if (root.get("KM").startsWith("7.5")) root.set("RU", "Chinese");
		if (root.get("KM").startsWith("6.5")) root.set("RU", "Japanese");
	}
}

function apply_all_fixes(root, guess_ruleset) {

	apply_komi_fix(root);
	apply_pl_fix(root);
	apply_ruleset_fixes(root);

	if (guess_ruleset) {
		apply_ruleset_guess(root);		// AFTER the komi fix, above.
	}
}


module.exports = apply_all_fixes;
