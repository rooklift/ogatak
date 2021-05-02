"use strict";

const new_node = require("./node");
const split_buffer = require("./split_buffer");
const {handicap_stones, xy_to_s} = require("./utils");

function load_gib(buf) {

	let lines = split_buffer(buf);

	let root = new_node(null);
	let node = root;

	for (let line of lines) {

		line = line.toString().trim();

		// Names...

		if (line.startsWith("\\[GAMEBLACKNAME=") && line.endsWith("\\]")) {
			root.set("PB", line.slice(16, line.length -2));
		}

		if (line.startsWith("\\[GAMEWHITENAME=") && line.endsWith("\\]")) {
			root.set("PW", line.slice(16, line.length -2));
		}

		// Game info...

		if (line.startsWith("\\[GAMETAG=")) {
			let [dt, re, km] = parse_gib_gametag(line);
			if (dt) root.set("DT", dt);
			if (re) root.set("RE", re);
			if (km) root.set("KM", km);
		}

		// Split the line into tokens for the handicap and move parsing...

		let fields = line.split(" ").filter(z => z !== "");

		// Handicap...

		if (fields.length >= 4 && fields[0] === "INI") {

			if (node != root) {
				throw "GIB load error: got INI after moves were made";
			}

			let handicap = parseInt(fields[3], 10);

			if (Number.isNaN(handicap) === false && handicap > 1) {
				root.set("HA", handicap);
				for (let s of handicap_stones(handicap, 19, 19, true)) {
					root.add_value("AB", s);
				}
			}
		}

		// Moves...

		if (fields.length >= 6 && fields[0] === "STO") {

			let x = parseInt(fields[4], 10);
			let y = parseInt(fields[5], 10);

			if (Number.isNaN(x) === false && Number.isNaN(y) === false) {
				let key = fields[3] === "2" ? "W" : "B";
				node = new_node(node);
				node.set(key, xy_to_s(x, y));
			}
		}
	}

	return root;
}

function parse_gib_gametag(line) {

	return ["", "", ""];	// TODO

}



module.exports = load_gib;
