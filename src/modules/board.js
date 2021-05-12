"use strict";

const {opposite_colour, xy_to_s} = require("./utils");

function new_board(width, height, state = null, ko = null, komi = 0, rules = "Unknown", active = "b", caps_by_b = 0, caps_by_w = 0) {

	let ret = Object.create(board_prototype);

	ret.width = width;
	ret.height = height;
	ret.state = [];
	ret.ko = ko;
	ret.komi = komi;
	ret.rules = rules;
	ret.active = active;
	ret.caps_by_b = caps_by_b;
	ret.caps_by_w = caps_by_w;

	for (let x = 0; x < width; x++) {
		ret.state.push([]);
		for (let y = 0; y < height; y++) {
			if (state) {
				ret.state[x].push(state[x][y]);
			} else {
				ret.state[x].push("");
			}
		}
	}

	return ret;
}

let board_prototype = {

	copy: function() {
		return new_board(this.width, this.height, this.state, this.ko, this.komi, this.rules, this.active, this.caps_by_b, this.caps_by_w);
	},

	in_bounds: function(s) {				// Note: any pass-ish things are not "in bounds".

		if (typeof s !== "string" || s.length !== 2) {
			return false;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	},

	state_at: function(s) {

		if (this.in_bounds(s) === false) {
			return "";
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return this.state[x][y];
	},

	set_at: function(s, colour) {

		if (this.in_bounds(s) === false) {
			return;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		this.state[x][y] = colour;
	},

	one_liberty_singleton: function(s) {

		let colour = this.state_at(s);

		if (!colour) {
			return false;
		}

		let liberties = 0;

		for (let neighbour of this.neighbours(s)) {

			let neighbour_colour = this.state_at(neighbour);

			if (neighbour_colour === colour) {
				return false;
			}

			if (!neighbour_colour) {
				liberties++;
			}
		}

		return liberties === 1;
	},

	neighbours: function(s) {

		let ret = [];

		if (this.in_bounds(s) === false) {
			return ret;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		for (let offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {

			let z = xy_to_s(x + offset[0], y + offset[1]);

			if (this.in_bounds(z)) {
				ret.push(z);
			}
		}

		return ret;
	},

	ko_square_finder: function(s) {

		for (let neighbour of this.neighbours(s)) {
			if (!this.state_at(neighbour)) {
				return neighbour;
			}
		}

		return null;
	},

	destroy_group: function(s) {

		let colour = this.state_at(s);

		if (!colour) {
			return 0;
		}

		this.set_at(s, "");

		if (colour === "b") {
			this.caps_by_w++;
		} else {
			this.caps_by_b++;
		}

		let caps = 1;

		for (let neighbour of this.neighbours(s)) {
			if (this.state_at(neighbour) === colour) {
				caps += this.destroy_group(neighbour);
			}
		}

		return caps;
	},

	has_liberties: function(s) {

		if (!this.state_at(s)) {
			return false;						// I guess?
		}

		let touched = Object.create(null);

		return this.has_liberties_recurse(s, touched);
	},

	has_liberties_recurse: function(s, touched) {

		touched[s] = true;

		let colour = this.state_at(s);

		for (let neighbour of this.neighbours(s)) {

			// Note that, by checking touched at the start, we allow suicide checking by
			// setting the potentially suicidal stone as touched without actually playing it.

			if (touched[neighbour]) {
				continue;
			}

			let neighbour_colour = this.state_at(neighbour);

			if (!neighbour_colour) {
				return true;
			}

			if (neighbour_colour === colour) {
				if (this.has_liberties_recurse(neighbour, touched)) {
					return true;
				}
			}
		}

		return false;
	},

	legalmove: function(s) {								// Note: does not consider passes as "legal moves".
		return this.legalmove_colour(s, this.active);
	},

	legalmove_colour: function(s, colour) {					// Note: does not consider passes as "legal moves".

		if (this.in_bounds(s) === false) {
			return false;
		}

		if (this.state_at(s)) {
			return false;
		}

		if (this.ko === s) {
			return false;
		}

		// Move will be legal as long as it's not suicide...

		let neighbours = this.neighbours(s);

		for (let neighbour of neighbours) {
			if (!this.state_at(neighbour)) {
				return true;					// New stone has a liberty.
			}
		}

		for (let neighbour of neighbours) {
			if (this.state_at(neighbour) === colour) {
				let touched = Object.create(null);
				touched[s] = true;
				if (this.has_liberties_recurse(neighbour, touched)) {
					return true;				// One of the groups we're joining has a liberty other than s.
				}
			} else if (this.state_at(neighbour) === opposite_colour(colour)) {
				let touched = Object.create(null);
				touched[s] = true;
				if (this.has_liberties_recurse(neighbour, touched) === false) {
					return true;				// One of the enemy groups has no liberties other than s.
				}
			}
		}

		return false;
	},

	play_move_or_pass: function(s, colour) {			// No legality checks.

		if (colour !== "b" && colour !== "w") {
			throw "play_move_or_pass() - Invalid colour";
		}

		this.ko = null;
		this.active = colour === "b" ? "w" : "b";

		if (this.in_bounds(s) === false) {				// Treat as a pass.
			return;
		}

		this.set_at(s, colour);
		let caps = 0;

		for (let neighbour of this.neighbours(s)) {

			let neighbour_colour = this.state_at(neighbour);

			if (neighbour_colour && neighbour_colour !== colour) {
				if (this.has_liberties(neighbour) === false) {
					caps += this.destroy_group(neighbour);
				}
			}
		}

		if (this.has_liberties(s) === false) {
			this.destroy_group(s);
		}

		if (caps === 1) {
			if (this.one_liberty_singleton(s)) {
				this.ko = this.ko_square_finder(s);
			}
		}
	},

	play_black: function(s) {
		this.play_move_or_pass(s, "b");
	},

	play_white: function(s) {
		this.play_move_or_pass(s, "w");
	},

	play: function(s) {
		if (this.active === "b") {
			this.play_move_or_pass(s, "b");
		} else if (this.active === "w") {
			this.play_move_or_pass(s, "w");
		}
	},

	add_empty: function(s) {
		this.set_at(s, "");
	},

	add_black: function(s) {
		this.set_at(s, "b");
	},

	add_white: function(s) {
		this.set_at(s, "w");
	},

	gtp: function(s) {													// "jj" --> "K10"		(off-board becomes "pass")
		if (this.in_bounds(s) === false) {
			return "pass";
		}
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		let letter_adjust = x >= 8 ? 1 : 0;
		let letter = String.fromCharCode(x + 65 + letter_adjust);
		let number = this.height - y;
		return letter + number.toString();
	},

	gtp_from_xy(x, y) {													// (9, 9) --> "K10"		(off-board becomes "pass")
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
			return "pass";
		}
		let letter_adjust = x >= 8 ? 1 : 0;
		let letter = String.fromCharCode(x + 65 + letter_adjust);
		let number = this.height - y;
		return letter + number.toString();
	},

	parse_gtp_move: function(s) {										// "K10" --> "jj"		(off-board becomes "")

		if (typeof s !== "string" || s.length < 2 || s === "pass") {
			return "";
		}

		let x = s.charCodeAt(0) - 65;
		if (x >= 8) {					// Adjust for missing "I"
			x--;
		}

		let y = this.height - parseInt(s.slice(1), 10);

		if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0 || x >= this.width || y >= this.height) {
			return "";
		}

		return xy_to_s(x, y);
	},

	setup_list: function() {
		let ret = [];
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				if (this.state[x][y] === "b") {
					ret.push(["B", this.gtp_from_xy(x, y)]);
				}
				if (this.state[x][y] === "w") {
					ret.push(["W", this.gtp_from_xy(x, y)]);
				}
			}
		}
		return ret;
	},

};



module.exports = new_board;
