"use strict";

// The board object contains info about the state of a game of Go,
// including ko, captures, player-to-move, and rules.
//
// Note that functions which take a point argument generally expect
// it to be a string in SGF format, e.g. "cc".
//
// The state at each board point is either "" or "b" or "w".

const {xy_to_s, points_list} = require("./utils");
const zobrist = require("./zobrist");

function new_board(
	width, height, state = null, pos_hash = null, ko = null, komi = 0, rules = "Unknown", active = "b", caps_by_b = 0, caps_by_w = 0) {

	let ret = Object.create(board_prototype);

	ret.width = width;
	ret.height = height;
	ret.state = [];
	ret.pos_hash = pos_hash;				// This is either null or a zobrist hash value for [stones ^ width ^ height]
	ret.ko = ko;							// Note that ko might not be valid, call has_valid_ko() to check
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

	if (state === null && zobrist.supported_size(width, height)) {
		ret.pos_hash = zobrist.widths[width] ^ zobrist.heights[height];
	}

	return ret;
}

let board_prototype = {

	copy: function() {
		return new_board(this.width, this.height, this.state, this.pos_hash, this.ko, this.komi, this.rules, this.active, this.caps_by_b, this.caps_by_w);
	},

	has_valid_ko: function() {
		if (!this.ko) {
			return false;
		}
		let inactive = (this.active === "b") ? "w" : "b";
		for (let neighbour of this.neighbours(this.ko)) {				// If the active player has been unnaturally
			if (this.state_at(neighbour) !== inactive) {				// flipped, this test will detect it...
				return false;
			}
		}
		return true;
	},

	in_bounds: function(s) {

		// Returns true / false if the point is on the board.
		// Note: any pass-ish things are not "in bounds".

		if (typeof s !== "string" || s.length !== 2) {
			return false;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	},

	state_at: function(s) {

		// Converts the point to [x][y] and returns the state there, "" or "b" or "w".

		if (!this.in_bounds(s)) {
			return "";
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return this.state[x][y];
	},

	set_at: function(s, colour) {

		// Converts the point to [x][y] and sets the state there, colour should be "" or "b" or "w".
		// Adjusts the zobrist if we have one. So nothing else should ever set .state.

		if (!this.in_bounds(s)) {
			return;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		if (this.pos_hash !== null) {			// It's null if the size is not supported.

			let i = (y + 1) * (this.width + 1) + x + 1;

			// If we're overwriting a stone, xor out the old thing...

			if (this.state[x][y] === "b") {
				this.pos_hash ^= zobrist.black_stones[i];
			} else if (this.state[x][y] === "w") {
				this.pos_hash ^= zobrist.white_stones[i];
			}

			// If we're adding a stone, xor in the new thing...

			if (colour === "b") {
				this.pos_hash ^= zobrist.black_stones[i];
			} else if (colour === "w") {
				this.pos_hash ^= zobrist.white_stones[i];
			}
		}

		this.state[x][y] = colour;
	},

	zobrist: function() {
		let hash = this.pos_hash;
		if (hash === null) {
			return null;
		}
		if (this.has_valid_ko()) {
			let x = this.ko.charCodeAt(0) - 97;
			let y = this.ko.charCodeAt(1) - 97;
			let i = (y + 1) * (this.width + 1) + x + 1;
			hash ^= zobrist.ko_locs[i];
		}
		hash ^= (this.active === "b") ? zobrist.black : zobrist.white;
		return hash;
	},

	zobrist_string: function() {
		let hash = this.zobrist();
		if (hash === null) {
			return "";
		}
		let s = hash.toString(16);
		if (s.length < 32) {
			s = "0".repeat(32 - s.length) + s; 
		}
		return s.toUpperCase();
	},

	one_liberty_singleton: function(s) {

		// True iff the point has a stone which is not
		// part of a group and has exactly 1 liberty.

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

		// Returns a list of points (in SGF format, e.g. "cc")
		// which neighbour the point given.

		let ret = [];

		if (!this.in_bounds(s)) {
			return ret;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		if (x < this.width  - 1) ret.push(xy_to_s(x + 1, y));
		if (x > 0)               ret.push(xy_to_s(x - 1, y));
		if (y < this.height - 1) ret.push(xy_to_s(x, y + 1));
		if (y > 0)               ret.push(xy_to_s(x, y - 1));

		return ret;
	},

	empty_neighbour: function(s) {

		// Returns an arbitrary empty neighbour of a point.
		// Useful for finding ko square.

		for (let neighbour of this.neighbours(s)) {
			if (!this.state_at(neighbour)) {
				return neighbour;
			}
		}

		return null;
	},

	destroy_group: function(s) {

		// Destroys the group and returns the number of stones removed.

		let group = this.group_at(s);
		let colour = this.state_at(s);

		for (let point of group) {
			this.set_at(point, "");
		}

		if (colour === "b") this.caps_by_w += group.length;
		if (colour === "w") this.caps_by_b += group.length;

		return group.length;
	},

	group_at: function(s) {

		if (!this.state_at(s)) {
			return [];
		}

		let touched = Object.create(null);

		this.group_at_recurse(s, touched);

		return Object.keys(touched);
	},

	group_at_recurse: function(s, touched) {

		touched[s] = true;

		let colour = this.state_at(s);

		for (let neighbour of this.neighbours(s)) {

			if (touched[neighbour]) {
				continue;
			}

			if (this.state_at(neighbour) === colour) {
				this.group_at_recurse(neighbour, touched);
			}
		}
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

			// Note that, by checking touched at the start, we allow legality checking by setting
			// the potentially suicidal / capturing stone as touched without actually playing it.

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

	legal_move: function(s) {

		// Returns true if the active player can legally play at the point given.
		// Note: does NOT consider passes as "legal moves".

		if (!this.in_bounds(s)) {
			return false;
		}

		if (this.state_at(s)) {
			return false;
		}

		let neighbours = this.neighbours(s);

		if (this.ko === s && this.has_valid_ko()) {		// 2nd test is needed since .ko can be invalid if active player was flipped.
			return false;
		}

		// Move will be legal as long as it's not suicide...

		for (let neighbour of neighbours) {
			if (!this.state_at(neighbour)) {
				return true;					// New stone has a liberty.
			}
		}

		// Note that the above test is done there rather than inside the loop below
		// because it's super-cheap and so worth doing in its entirety first.

		let inactive = (this.active === "b") ? "w" : "b";

		for (let neighbour of neighbours) {
			if (this.state_at(neighbour) === this.active) {
				let touched = Object.create(null);
				touched[s] = true;
				if (this.has_liberties_recurse(neighbour, touched)) {
					return true;				// One of the groups we're joining has a liberty other than s.
				}
			} else if (this.state_at(neighbour) === inactive) {
				let touched = Object.create(null);
				touched[s] = true;
				if (!this.has_liberties_recurse(neighbour, touched)) {
					return true;				// One of the enemy groups has no liberties other than s.
				}
			}
		}

		return false;
	},

	play: function(s, colour) {					// If colour is not specified, uses this.active.

		// Play the move (or pass) given... contains no legality checks... can play ko... can play the inactive colour!

		if (colour === undefined) {
			colour = this.active;
		}

		if (colour !== "b" && colour !== "w") {
			throw new Error("play(): invalid colour");
		}

		this.ko = null;
		this.active = (colour === "b") ? "w" : "b";

		if (!this.in_bounds(s)) {				// Treat as a pass.
			return;
		}

		this.set_at(s, colour);
		let caps = 0;

		for (let neighbour of this.neighbours(s)) {

			let neighbour_colour = this.state_at(neighbour);

			if (neighbour_colour && neighbour_colour !== colour) {
				if (!this.has_liberties(neighbour)) {
					caps += this.destroy_group(neighbour);
				}
			}
		}

		if (!this.has_liberties(s)) {
			this.destroy_group(s);
		}

		if (caps === 1) {
			if (this.one_liberty_singleton(s)) {
				this.ko = this.empty_neighbour(s);
			}
		}
	},

	add_empty: function(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "");
		}
		this.ko = null;
	},

	add_black: function(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "b");
		}
		this.ko = null;
	},

	add_white: function(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "w");
		}
		this.ko = null;
	},

	gtp: function(s) {													// "jj" --> "K10"		(off-board becomes "pass")
		if (!this.in_bounds(s)) {
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

		// Returns a list of [player string, location string] tuples which can be sent to
		// KataGo as its "initialStones" argument.

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
