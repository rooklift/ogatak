"use strict";

const stringify = require("./stringify");

exports.xy_to_s = function(x, y) {

	if (x < 0 || x > 25 || y < 0 || y > 25) {
		return "";
	}

	return String.fromCharCode(x + 97) + String.fromCharCode(y + 97);
};

exports.replace_all = function(s, search, replace) {
	if (!s.includes(search)) return s;			// Seems to improve speed overall.
	return s.split(search).join(replace);
};

exports.opposite_colour = function(s) {
	if (s === "b") return "w";
	if (s === "w") return "b";
	if (s === "B") return "W";
	if (s === "W") return "B";
	return "";
};

exports.event_path_string = function(event, prefix) {

	// Given an event with event.path like ["foo", "bar", "searchmove_e2e4", "whatever"]
	// return the string "e2e4", assuming the prefix matches. Else return null.

	if (!event || typeof prefix !== "string") {
		return null;
	}

	let path = event.path || (event.composedPath && event.composedPath());

	if (path) {
		for (let item of path) {
			if (typeof item.id === "string") {
				if (item.id.startsWith(prefix)) {
					return item.id.slice(prefix.length);
				}
			}
		}
	}

	return null;
};

exports.event_path_class_string = function(event, prefix) {

	// As above, but looks at class rather than id.

	if (!event || typeof prefix !== "string") {
		return null;
	}

	let path = event.path || (event.composedPath && event.composedPath());

	if (path) {
		for (let item of path) {
			if (typeof item.className === "string" && item.className !== "") {
				let classes = item.className.split(" ");
				for (let cl of classes) {
					if (cl.startsWith(prefix)) {
						return cl.slice(prefix.length);
					}
				}
			}
		}
	}

	return null;
};

exports.node_id_from_search_id = function(s) {		// "node_123:456" --> "node_123"
	if (typeof s !== "string") {
		return "";
	}
	if (s.includes(":") === false) {
		return "";
	}
	return s.slice(0, s.indexOf(":"));
};

exports.handicap_stones = function(count, width, height, tygem) {

	// From the Sabaki project by Yichuan Shen, with modifications.
	// https://github.com/SabakiHQ/go-board

	if (Math.min(width, height) <= 6 || count < 2) {
		return [];
	}

	let [nearx, neary] = [width, height].map(z => z >= 13 ? 3 : 2);
	let [farx, fary] = [width - nearx - 1, height - neary - 1];
	let [middlex, middley] = [width, height].map(z => (z - 1) / 2);

	let result;

	if (tygem) {
		result = [[nearx, fary], [farx, neary], [nearx, neary], [farx, fary]];
	} else {
		result = [[nearx, fary], [farx, neary], [farx, fary], [nearx, neary]];
	}

	if (width % 2 !== 0 && height % 2 !== 0 && (width >= 9 || height >= 9)) {

		// The point here is to get the tengen stone at the correct index in the list
		// so that it either is or isn't included in the final slice.

		if (count === 5) {
			result.push([middlex, middley]);
		}

		result.push([nearx, middley], [farx, middley]);

		if (count === 7) {
			result.push([middlex, middley]);
		}

		result.push([middlex, neary], [middlex, fary]);

		if (count >= 9) {
			result.push([middlex, middley]);
		}

	}

	return result.slice(0, count).map(z => exports.xy_to_s(z[0], z[1]));
};

exports.pad = function(s, width) {

	s = stringify(s);

	if (s.length >= width) {
		return s;					// or s.slice(0, width), but that can cause confusion
	}

	let padding = " ".repeat(width - s.length);

	return s + padding;
};

exports.moveinfo_filter = function(node) {

	if (node.has_valid_analysis() === false) {
		return [];
	}

	let ret = [];

	let move0_lcb = node.analysis.moveInfos[0].lcb;
	for (let info of node.analysis.moveInfos) {
		if (info.order === 0 || (info.visits > node.analysis.rootInfo.visits * config.visits_threshold)) {
			ret.push(info);
		}
	}

	return ret;
};

exports.new_2d_array = function(width, height, defval) {

	let ret = [];

	for (let x = 0; x < width; x++) {
		ret.push([]);
		for (let y = 0; y < height; y++) {
			ret[x].push(defval);
		}
	}

	return ret;
};
