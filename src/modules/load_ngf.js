"use strict";

const new_node = require("./node");
const split_buffer = require("./split_buffer");
const {handicap_stones, xy_to_s} = require("./utils");

function load_ngf(buf) {

	let lines = split_buffer(buf);

	if (lines.length < 12) {
		throw "NGF load error: file too short";
	}

	// ------------------------------------------------------------------------------------------------

	let boardsize = parseInt(lines[1].toString(), 10);

	if (Number.isNaN(boardsize)) {
		boardsize = 19;
	}

	// ------------------------------------------------------------------------------------------------

	let pw = "";
	let pb = "";

	let pw_fields = lines[2].toString().split(" ").filter(z => z !== "");
	let pb_fields = lines[3].toString().split(" ").filter(z => z !== "");

	if (pw_fields.length > 0 && pw_fields[0].includes("�") === false) {
		pw = pw_fields[0];
	}

	if (pb_fields.length > 0 && pb_fields[0].includes("�") === false) {
		pb = pb_fields[0];
	}

	// ------------------------------------------------------------------------------------------------

	let handicap = parseInt(lines[5].toString(), 10);

	if (Number.isNaN(handicap)) {
		handicap = 0;
	}
	if (handicap < 0 || handicap > 9) {
		throw "NGF load error: bad handicap";
	}

	// ------------------------------------------------------------------------------------------------

	let komi = parseFloat(lines[7].toString());

	if (Number.isNaN(komi)) {
		komi = 0;
	} else if (Math.floor(komi) === komi) {
		komi += 0.5;
	}

	// ------------------------------------------------------------------------------------------------

	let rawdate = "";

	if (lines[8].length >= 8) {
		rawdate = lines[8].slice(0, 8).toString();
	}

	// ------------------------------------------------------------------------------------------------

	let re = "";
	let margin = "";

	let result_lower = lines[10].toString().toLowerCase();

	if (result_lower.includes("black win") || result_lower.includes("white los")) {
		re = "B+";
	}
	if (result_lower.includes("white win") || result_lower.includes("black los")) {
		re = "W+";
	}
	if (result_lower.includes("resign")) {
		margin = "R";
	}
	if (result_lower.includes("time")) {
		margin = "T";
	}

	if (re !== "") {
		re += margin;
	}

	// ------------------------------------------------------------------------------------------------

	let root = new_node(null);
	let node = root;

	root.set("SZ", boardsize);
	root.set("RU", "Korean");
	root.set("KM", komi);

	if (handicap > 1) {
		root.set("HA", handicap);
		for (let s of handicap_stones(handicap, boardsize, boardsize, true)) {
			root.add_value("AB", s);
		}
	}

	if (rawdate.length === 8) {
		let ok = true;
		for (let n = 0; n < 8; n++) {
			if (rawdate[n].charCodeAt(0) < 48 || rawdate[n].charCodeAt(0) > 57) {
				ok = false;
			}
		}
		if (ok) {
			root.set("DT", rawdate.slice(0, 4) + "-" + rawdate.slice(4, 6) + "-" + rawdate.slice(6, 8));
		}
	}

	if (pw) root.set("PW", pw);
	if (pb) root.set("PB", pb);
	if (re) root.set("RE", re);

	for (let line of lines) {

		line = line.toString().toUpperCase().trim();

		if (line.length < 7) {
			continue;
		}

		if (line.slice(0, 2) === "PM") {

			if (line[4] === "B" || line[4] === "W") {

				let key = line[4];

				let x = line.charCodeAt(5) - 66;
				let y = line.charCodeAt(6) - 66;

				node = new_node(node);

				if (x >= 0 && x < boardsize && y >= 0 && y < boardsize) {
					node.set(key, xy_to_s(x, y));
				} else {
					node.set(key, "");		// Pass
				}
			}
		}
	}

	if (root.children.length === 0) {
		throw "NGF load error: got no moves";
	}

	return [root];
}



module.exports = load_ngf;
