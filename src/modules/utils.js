"use strict";

const querystring = require("querystring");
const stringify = require("./stringify");

// ------------------------------------------------------------------------------------------------

exports.xy_to_s = function(x, y) {

	if (x < 0 || x >= 19 || y < 0 || y >= 19) {
		return "";
	}

	return String.fromCharCode(x + 97) + String.fromCharCode(y + 97);
};

exports.replace_all = function(s, search, replace) {
	if (!s.includes(search)) return s;			// Seems to improve speed overall.
	return s.split(search).join(replace);
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
	if (!s.includes(":")) {
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

	let stones;

	if (tygem) {
		stones = [[nearx, fary], [farx, neary], [nearx, neary], [farx, fary]];
	} else {
		stones = [[nearx, fary], [farx, neary], [farx, fary], [nearx, neary]];
	}

	if (width % 2 !== 0 && height % 2 !== 0 && (width >= 9 || height >= 9)) {

		if (count === 5 || count === 7 || count >= 9) {
			stones.push([middlex, middley]);
		}

		stones.push([nearx, middley], [farx, middley]);
		stones.push([middlex, neary], [middlex, fary]);

	}

	return stones.slice(0, count).map(z => exports.xy_to_s(z[0], z[1]));
};

exports.pad = function(s, width, leftflag) {

	if (typeof s !== "string") {	// Necessary test because stringify runs .trim() which can affect the result
		s = stringify(s);
	}

	if (s.length >= width) {
		return s;					// or s.slice(0, width), but that can cause confusion
	}

	let padding = " ".repeat(width - s.length);

	return leftflag ? padding + s : s + padding;
};

exports.moveinfo_filter = function(node) {

	if (!node.has_valid_analysis()) {
		return [];
	}

	let ret = [];

	for (let info of node.analysis.moveInfos) {
		if (info.order === 0 || (info.visits > node.analysis.rootInfo.visits * config.visits_threshold)) {
			if (!info.isSymmetryOf) {
				ret.push(info);
			}
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

exports.float_to_hex_ff = function(n) {
	if (n < 0) n = 0;
	if (n > 1) n = 1;
	n = Math.floor(n * 255);
	let s = n.toString(16);
	if (s.length === 1) s = "0" + s;
	return s;
};

exports.int_to_hex_ff = function(n) {
	if (n < 0) n = 0;
	if (n > 255) n = 255;
	let s = n.toString(16);
	if (s.length === 1) s = "0" + s;
	return s;
};

exports.points_list = function(s) {

	// Note that the values returned are not guaranteed to be valid / on-board etc.

	if (s.length === 2) {
		return [s];
	}

	if (s.length !== 5 || s[2] !== ":") {
		return [];
	}

	let ret = [];

	let x1 = s.charCodeAt(0) - 97;
	let y1 = s.charCodeAt(1) - 97;
	let x2 = s.charCodeAt(3) - 97;
	let y2 = s.charCodeAt(4) - 97;

	if (x1 > x2) {
		let tmp = x1; x1 = x2; x2 = tmp;
	}

	if (y1 > y2) {
		let tmp = y1; y1 = y2; y2 = tmp;
	}

	for (let x = x1; x <= x2; x++) {
		for (let y = y1; y <= y2; y++) {
			let z = exports.xy_to_s(x, y);
			if (z) {
				ret.push(z);
			}
		}
	}

	return ret;
};

exports.valid_analysis_object = function(o) {		// Return value must be true or false, don't do cheap "return a && b" tricks.

	if (typeof o !== "object" || o === null || o.noResults) {
		return false;
	}

	if (Array.isArray(o.moveInfos) && o.moveInfos.length > 0 && o.rootInfo) {
		return true;
	}

	return false;
};

exports.parse_version = function(s) {

	if (typeof s !== "string") {
		return [0, 0, 0];
	}

	let parts = s.split(".");

	if (parts.length !== 3) {
		return [0, 0, 0];
	}

	let ret = [];

	for (let part of parts) {
		let n = parseInt(part, 10);
		if (Number.isNaN(n)) {
			return [0, 0, 0];
		}
		ret.push(n);
	}

	return ret;
};

exports.compare_versions = function(a, b) {		// args are both arrays like [1,8,2]

	if (a[0] < b[0]) return -1;
	if (a[0] > b[0]) return 1;

	if (a[1] < b[1]) return -1;
	if (a[1] > b[1]) return 1;

	if (a[2] < b[2]) return -1;
	if (a[2] > b[2]) return 1;

	return 0;
};

exports.get_href_query_val = function(key) {
	let s = global.location.search;
	if (s[0] === "?") s = s.slice(1);
	return querystring.parse(s)[key];
};

exports.safe_html = function(s) {
	s = exports.replace_all(s,  `&`  ,  `&amp;`   );		// This needs to be first of course.
	s = exports.replace_all(s,  `<`  ,  `&lt;`    );
	s = exports.replace_all(s,  `>`  ,  `&gt;`    );
	s = exports.replace_all(s,  `'`  ,  `&apos;`  );
	s = exports.replace_all(s,  `"`  ,  `&quot;`  );
	return s;
};

exports.undo_safe_html = function(s) {
	s = exports.replace_all(s,  `&quot;`  ,  `"`  );
	s = exports.replace_all(s,  `&apos;`  ,  `'`  );
	s = exports.replace_all(s,  `&gt;`    ,  `>`  );
	s = exports.replace_all(s,  `&lt;`    ,  `<`  );
	s = exports.replace_all(s,  `&amp;`   ,  `&`  );		// So I guess do this last.
	return s;
};
