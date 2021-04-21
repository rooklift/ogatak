"use strict"

function NewBoard(width, height, state = null, ko = null, active = "b") {

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

	add_black: function() {
		// TODO - return a new board.
	},

	add_white: function() {
		// TODO - return a new board.
	},

	play_black: function() {
		// TODO - return a new board.
	},

	play_white: function() {
		// TODO - return a new board.
	},

};

