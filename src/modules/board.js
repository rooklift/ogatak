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

function new_board(...args) {
	return new Board(...args);
}

class Board {

	constructor(width, height, state = null, pos_hash = null, ko = null, active = "b", caps_by_b = 0, caps_by_w = 0, stones_b = 0, stones_w = 0) {

		this.width = width;
		this.height = height;
		this.state = [];
		this.pos_hash = pos_hash;				// This is either null or a zobrist hash value for [stones ^ width ^ height]
		this.ko = ko;							// Note that ko might not be valid, call get_ko() instead
		this.active = active;
		this.caps_by_b = caps_by_b;
		this.caps_by_w = caps_by_w;
		this.stones_b = stones_b;				// We could just count these as needed. Maybe this is bad optimisation...
		this.stones_w = stones_w;

		for (let x = 0; x < width; x++) {
			this.state.push([]);
			for (let y = 0; y < height; y++) {
				if (state) {
					this.state[x].push(state[x][y]);
				} else {
					this.state[x].push("");
				}
			}
		}

		if (state === null && zobrist.supported_size(width, height)) {
			this.pos_hash = zobrist.widths[width] ^ zobrist.heights[height];
		}
	}

	copy() {
		return new_board(
			this.width, this.height, this.state, this.pos_hash, this.ko,
			this.active, this.caps_by_b, this.caps_by_w, this.stones_b, this.stones_w
		);
	}

	get_ko() {
		if (!this.ko) {
			return null;
		}
		let inactive = (this.active === "b") ? "w" : "b";
		for (let neighbour of this.neighbours(this.ko)) {				// If the active player has been unnaturally
			if (this.state_at(neighbour) !== inactive) {				// flipped, this test will detect it...
				return null;
			}
		}
		return this.ko;
	}

	in_bounds(s) {

		// Returns true / false if the point is on the board.
		// Note: any pass-ish things are not "in bounds".

		if (typeof s !== "string" || s.length !== 2) {
			return false;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	}

	state_at(s) {

		// Converts the point to [x][y] and returns the state there, "" or "b" or "w".

		if (!this.in_bounds(s)) {
			return "";
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return this.state[x][y];
	}

	set_at(s, colour) {

		// Converts the point to [x][y] and sets the state there, colour should be "" or "b" or "w".
		// Adjusts the zobrist if we have one. Also adjusts our stone counts.
		// So **nothing else** should ever set .state.

		if (!this.in_bounds(s)) {
			return;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		let i = (y + 1) * (this.width + 1) + x + 1;

		// If we're overwriting a stone, xor out the old thing...

		if (this.state[x][y] === "b") {
			if (this.pos_hash !== null) {
				this.pos_hash ^= zobrist.black_stones[i];
			}
			this.stones_b--;
		} else if (this.state[x][y] === "w") {
			if (this.pos_hash !== null) {
				this.pos_hash ^= zobrist.white_stones[i];
			}
			this.stones_w--;
		}

		// If we're adding a stone, xor in the new thing...

		if (colour === "b") {
			if (this.pos_hash !== null) {
				this.pos_hash ^= zobrist.black_stones[i];
			}
			this.stones_b++;
		} else if (colour === "w") {
			if (this.pos_hash !== null) {
				this.pos_hash ^= zobrist.white_stones[i];
			}
			this.stones_w++;
		}

		this.state[x][y] = colour;
	}

	caps_balance() {
		return this.caps_by_b - this.caps_by_w;
	}

	zobrist() {
		let hash = this.pos_hash;
		if (hash === null) {
			return null;
		}
		let ko = this.get_ko();
		if (ko) {
			let x = ko.charCodeAt(0) - 97;
			let y = ko.charCodeAt(1) - 97;
			let i = (y + 1) * (this.width + 1) + x + 1;
			hash ^= zobrist.ko_locs[i];
		}
		hash ^= (this.active === "b") ? zobrist.black : zobrist.white;
		return hash;
	}

	zobrist_string() {
		let hash = this.zobrist();
		if (hash === null) {
			return "";
		}
		let s = hash.toString(16);
		if (s.length < 32) {
			s = "0".repeat(32 - s.length) + s;
		}
		return s.toUpperCase();
	}

	one_liberty_singleton(s) {

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
	}

	neighbours(s) {

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
	}

	empty_neighbour(s) {

		// Returns an arbitrary empty neighbour of a point.
		// Useful for finding ko square.

		for (let neighbour of this.neighbours(s)) {
			if (!this.state_at(neighbour)) {
				return neighbour;
			}
		}

		return null;
	}

	destroy_group(s) {

		// Destroys the group and returns the number of stones removed.

		let group = this.group_at(s);
		let colour = this.state_at(s);

		for (let point of group) {
			this.set_at(point, "");
		}

		if (colour === "b") this.caps_by_w += group.length;
		if (colour === "w") this.caps_by_b += group.length;

		return group.length;
	}

	group_at(s) {

		let colour = this.state_at(s);

		if (!colour) {
			return [];
		}

		let result = Object.create(null); result[s] = true;
		let queue = []; queue.push(s);
		let qi = -1;

		while (++qi < queue.length) {
			let z = queue[qi];
			for (let neighbour of this.neighbours(z)) {
				if (result[neighbour]) {
					continue;
				}
				if (this.state_at(neighbour) === colour) {
					result[neighbour] = true;					// In BFS, important to add to result as soon as discovered,
					queue.push(neighbour);						// to prevent things from being added to the queue twice or more.
				}
			}
		}

		return Object.keys(result);
	}

	has_liberties(s) {

		let colour = this.state_at(s);

		if (!colour) {
			return false;										// I guess?
		}

		let seen = Object.create(null); seen[s] = true;
		let queue = []; queue.push(s);
		let qi = -1;

		while (++qi < queue.length) {
			let z = queue[qi];
			for (let neighbour of this.neighbours(z)) {
				if (seen[neighbour]) {
					continue;
				}
				let c = this.state_at(neighbour);
				if (c === "") {
					return true;
				}
				seen[neighbour] = true;							// Add to seen as soon as discovered. See note above.
				if (c === colour) {
					queue.push(neighbour);
				}
			}
		}

		return false;
	}

	legal_move(s) {

		// Returns true if the active player can legally play at the point given.
		// Note: does NOT consider passes as "legal moves".

		if (!this.in_bounds(s)) {
			return false;
		}

		if (this.state_at(s)) {
			return false;
		}

		if (this.get_ko() === s) {
			return false;
		}

		// Move will be legal as long as it's not suicide...

		try {									// Using try... finally pattern to always undo the following temp stone placement.
			this.set_at(s, this.active);		// A little inefficient since it leads to zobrist hashing, but legal_move() is rarely called.
			if (this.has_liberties(s)) {
				return true;
			}
			let inactive = (this.active === "b") ? "w" : "b";
			for (let neighbour of this.neighbours(s)) {
				if (this.state_at(neighbour) === inactive) {
					if (!this.has_liberties(neighbour)) {
						return true;			// One of the enemy groups has no liberties other than s.
					}
				}
			}
		} finally {								// Gets done even if we return in the try {} block.
			this.set_at(s, "");
		}

		return false;
	}

	play(s, colour) {							// If colour is not specified, uses this.active.

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
	}

	add_empty(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "");
		}
		this.ko = null;
	}

	add_black(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "b");
		}
		this.ko = null;
	}

	add_white(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "w");
		}
		this.ko = null;
	}

	gtp(s) {															// "jj" --> "K10"		(off-board becomes "pass")
		if (!this.in_bounds(s)) {
			return "pass";
		}
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		let letter_adjust = x >= 8 ? 1 : 0;
		let letter = String.fromCharCode(x + 65 + letter_adjust);
		let number = this.height - y;
		return letter + number.toString();
	}

	gtp_from_xy(x, y) {													// (9, 9) --> "K10"		(off-board becomes "pass")
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
			return "pass";
		}
		let letter_adjust = x >= 8 ? 1 : 0;
		let letter = String.fromCharCode(x + 65 + letter_adjust);
		let number = this.height - y;
		return letter + number.toString();
	}

	parse_gtp_move(s) {													// "K10" --> "jj"		(off-board becomes "")

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
	}

	setup_list() {

		// Returns a list of [player string, location string] tuples which can be sent to
		// KataGo as its "initialStones" argument. Should use uppercase B and W.

		let ret = [];
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				if (this.state[x][y] === "b") {
					ret.push(["B", this.gtp_from_xy(x, y)]);
				} else if (this.state[x][y] === "w") {
					ret.push(["W", this.gtp_from_xy(x, y)]);
				}
			}
		}
		return ret;
	}

	setup_sgf() {					// For debugging only. Returns the position as an SGF string.

		let AB = [];
		let AW = [];

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				if (this.state[x][y] === "b") {
					AB.push(xy_to_s(x, y));
				} else if (this.state[x][y] === "w") {
					AW.push(xy_to_s(x, y));
				}
			}
		}

		let s = "";

		if (this.width === this.height) {
			s += `SZ[${this.width}]`;
		} else {
			s += `SZ[${this.width}:${this.height}]`;
		}

		if (this.active === "b") {
			s += `PL[B]`;
		} else {
			s += `PL[W]`;
		}

		if (AB.length > 0) {
			s += `AB[${AB.join("][")}]`;
		}
		if (AW.length > 0) {
			s += `AW[${AW.join("][")}]`;
		}

		return `(;${s})`;
	}
}



module.exports = new_board;
