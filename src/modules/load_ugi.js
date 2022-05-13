"use strict";

// https://homepages.cwi.nl/~aeb/go/misc/ugf.html has some useful info.

const decoders = require("./decoders");
const new_node = require("./node");
const split_buffer = require("./split_buffer");
const {xy_to_s} = require("./utils");

function load_ugi(buf) {

	let decoder = decoders.get_decoder("UTF-8");		// Use this by default, but change if LANG line is seen.

	let lines = split_buffer(buf);

	let root = new_node();
	root.set("GM", 1);
	root.set("FF", 4);
	root.set("CA", "UTF-8");

	let node = root;

	let boardsize = 19;
	let section = null;
	let coordinate_type = null;							// Might be set to "IGS" in which case the meaning changes apparently.
	let AB_required = 0;

	for (let line of lines) {

		line = decoder.decode(line).trim();

		// Some lines will tell us which section we are in...

		if (line.startsWith("[") && line.endsWith("]")) {
			section = line.toUpperCase();
			continue;
		}

		// If we get a regular line, what we do depends on the section...

		if (section === "[HEADER]") {

			let upper = line.toUpperCase();

			if (upper.startsWith("LANG=")) {

				let lang = line.slice(5);
				if (decoders.available(lang)) {
					decoder = decoders.get_decoder(lang);
				}

			} else if (upper.startsWith("HDCP=")) {

				let handicap_and_komi = line.slice(5);

				if (!handicap_and_komi.includes(",")) {
					continue;										// Ignore this line, I guess, it's not the expected format.
				}

				let [handicap_string, komi_string] = handicap_and_komi.split(",");		// i.e. items 0 and 1 of the split.

				let handicap = parseInt(handicap_string, 10);
				if (!Number.isNaN(handicap) && handicap > 0) {
					root.set("HA", handicap);
					AB_required = handicap;
				}

				let komi = parseFloat(komi_string);
				if (!Number.isNaN(komi)) {
					root.set("KM", komi);
				}

			} else if (upper.startsWith("SIZE=")) {

				const size_string = line.slice(5);

				let tmp = parseInt(size_string, 10);

				if (!Number.isNaN(tmp) && tmp > 0 && tmp <= 19) {
					boardsize = tmp;
					root.set("SZ", boardsize);
				}

			} else if (upper.startsWith("COORDINATETYPE=")) {

				coordinate_type = line.slice(15).toUpperCase();

			} else if (upper.startsWith("PLAYERB=")) {

				let name = line.slice(8);
				if (name.includes(",")) {
					name = name.split(",")[0];
				}
				root.set("PB", name);

			} else if (upper.startsWith("PLAYERW=")) {

				let name = line.slice(8);
				if (name.includes(",")) {
					name = name.split(",")[0];
				}
				root.set("PW", name);

			} else if (upper.startsWith("PLACE=")) {

				root.set("PC", line.slice(6));

			} else if (upper.startsWith("TITLE=")) {

				root.set("GN", line.slice(6));

			} else if (upper.startsWith("WINNER=B")) {

				root.set("RE", "B+");

			} else if (upper.startsWith("WINNER=W")) {

				root.set("RE", "W+");

			}

		} else if (section === "[DATA]") {

			let slist = line.toUpperCase().split(",");

			if (slist.length < 3) {
				throw new Error("Data line was too short");
			}

			let xy_string = slist[0];

			if (xy_string.length !== 2) {
				throw new Error("Bad coordinate in data line");
			}

			let colour = slist[1][0];									// Conceivably could be undefined.

			if (colour !== "B" && colour !== "W") {
				throw new Error("Bad colour in data line");
			}

			let turn_string_char0 = slist[2][0];						// Conceivably could be undefined. Not sure why I look at char0 rather than whole string?

			let x;
			let y;

			if (coordinate_type === "IGS") {
				x = xy_string.charCodeAt(0) - 65;
				y = (boardsize - (xy_string.charCodeAt(1) - 64));
			} else {
				x = xy_string.charCodeAt(0) - 65;
				y = xy_string.charCodeAt(1) - 65;
			}

			let s;														// The sgf coordinate

			if (x < 0 || x >= boardsize || y < 0 || y >= boardsize) {	// Likely a pass, "YA" is often used as a pass
				s = "";
			} else {
				s = xy_to_s(x, y);
			}

			if (AB_required > 0 && turn_string_char0 === "0" && colour === "B" && node === root) {
				AB_required--;
				node.add_value("AB", s);
			} else {
				node = new_node(node);
				node.set(colour, s);
			}
		}
	}

	return [root];
}



module.exports = load_ugi;
