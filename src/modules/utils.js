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

exports.handicap_stones = function(handicap, width, height, tygem) {

	let z = Math.min(width, height);		// FIXME...
	let ret = [];

	if (z < 4 || handicap < 2) {
		return ret;
	}

	if (handicap > 9) handicap = 9;

	let d = 1;
	if (z >= 7) {
		d = 2;
	}
	if (z >= 13) {
		d = 3;
	}

	if (handicap >= 2) {
		ret.push(exports.xy_to_s(z - d - 1, d));
		ret.push(exports.xy_to_s(d, z - d - 1));
	}

	if (handicap >= 3) {
		if (tygem) {
			ret.push(exports.xy_to_s(d, d));
		} else {
			ret.push(exports.xy_to_s(z - d - 1, z - d - 1));
		}
	}

	if (handicap >= 4) {
		if (tygem) {
			ret.push(exports.xy_to_s(z - d - 1, z - d - 1));
		} else {
			ret.push(exports.xy_to_s(d, d));
		}
	}

	if (z % 2 === 0) {
		return ret;
	}

	if (handicap === 5 || handicap === 7 || handicap === 9) {
		ret.push(exports.xy_to_s(z / 2, z / 2));
	}

	if (handicap >= 6) {
		ret.push(exports.xy_to_s(d, z / 2));
		ret.push(exports.xy_to_s(z - d - 1, z / 2));
	}

	if (handicap >= 8) {
		ret.push(exports.xy_to_s(z / 2, d));
		ret.push(exports.xy_to_s(z / 2, z - d - 1));
	}

	return ret;
};

exports.pad = function(s, width) {

	s = stringify(s);

	if (s.length >= width) {
		return s;					// or s.slice(0, width), but that can cause confusion
	}

	let padding = " ".repeat(width - s.length);

	return s + padding;
};
