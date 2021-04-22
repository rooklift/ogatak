"use strict"

exports.NewBoard = function(width, height, state = null, ko = null, active = "b") {

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
				ret.state[x].push(ret.state[x][y]);
			} else {
				ret.state[x].push("");
			}
		}
	}

	return ret;
}

let board_prototype = {

	copy: function() {
		return NewBoard(this.width, this.height, this.state, this.ko, this.active);
	},

	in_bounds: function(s) {

		if (typeof s !== "string" || s.length !== 2) {
			return false;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	},

	play_stone: function(s, colour) {			// Mutate so we can build up a board from a sequence of SGF properties.

		if (colour !== "b" && colour !== "w") {
			throw "play_stone() - Invalid colour";
		}

		if (this.in_bounds(s) === false) return;

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		// TODO

	},

	play_black: function(s) {
		this.play_stone(s, "b");
	},

	play_white: function() {
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

