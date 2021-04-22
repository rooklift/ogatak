"use strict";

const XYtoS = require("./utils").XYtoS;

exports.NewBoard = function(width, height, state = null, ko = null, active = "b") {

	// FIXME - add captures

	let ret = Object.create(board_prototype);

	ret.width = width;
	ret.height = height;
	ret.state = [];
	ret.ko = ko;
	ret.active = active;

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
};

let board_prototype = {

	copy: function() {
		return exports.NewBoard(this.width, this.height, this.state, this.ko, this.active);
	},

	in_bounds: function(s) {

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

			let z = XYtoS(x + offset[0], y + offset[1]);

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

			let neighbour_colour = this.state_at(neighbour);

			if (!neighbour_colour) {
				return true;
			}

			if (neighbour_colour === colour) {
				if (!touched[neighbour]) {
					if (this.has_liberties_recurse(neighbour, touched)) {
						return true;
					}
				}
			}
		}

		return false;
	},

	legal: function(s) {
		return this.legal_colour(s, this.active);
	},

	legal_colour: function(s, colour) {

		if (this.in_bounds(s) === false) {
			return false;
		}

		if (this.state_at(s)) {
			return false;
		}

		if (this.ko === s) {
			return false;
		}

		return true;
	},

	play_stone: function(s, colour) {			// No legality checks.

		if (colour !== "b" && colour !== "w") {
			throw "play_stone() - Invalid colour";
		}

		this.ko = null;
		this.active = colour === "b" ? "w" : "b";

		if (this.in_bounds(s) === false) {		// Treat as a pass.
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
		this.play_stone(s, "b");
	},

	play_white: function(s) {
		this.play_stone(s, "w");
	},

	add_stone: function(s, colour) {
		if (this.in_bounds(s) === false) {
			return;
		}
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		this.state[x][y] = colour;
	},

	add_black: function(s) {
		this.add_stone(s, "b");
	},

	add_white: function() {
		this.add_stone(s, "w");
	},

};

