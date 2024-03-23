"use strict";

// Various stuff for debugging, info, etc. None of this is used by the GUI.
// These methods get added to the Node prototype.

const {array_to_set, xy_to_s} = require("./utils");

module.exports = {

	score: function(jp = false) {

		// Note that we rather assume we are at the game end. We also need ownership data.

		if (!this.has_valid_analysis() || !Array.isArray(this.analysis.ownership)) {
			return "No ownership data";
		}

		let board = this.get_board();

		let cap_value = jp ? 1 : 0;
		let stn_value = jp ? 0 : 1;

		let bscore = 0;
		let wscore = 0;

		let dame = this.dame();

		for (let x = 0; x < board.width; x++) {
			for (let y = 0; y < board.height; y++) {
				let s = xy_to_s(x, y);
				if (dame.includes(s)) {
					continue;
				}
				let own = this.analysis.ownership[x + (y * board.width)];
				if (own > 0) {
					if (board.state[x][y] === "") {
						bscore += 1;							// My territory
					} else if (board.state[x][y] === "w") {
						bscore += 1 + cap_value;				// My territory containing opponent's dead stone
					} else if (board.state[x][y] === "b") {
						bscore += stn_value;					// My living stone
					}
				} else if (own < 0) {
					if (board.state[x][y] === "") {
						wscore += 1;
					} else if (board.state[x][y] === "b") {
						wscore += 1 + cap_value;
					} else if (board.state[x][y] === "w") {
						wscore += stn_value;
					}
				}
			}
		}

		bscore += board.caps_by_b * cap_value;
		wscore += board.caps_by_w * cap_value;
		wscore += this.komi();

		if (bscore > wscore) {
			return `B+${bscore - wscore}`;
		} else if (wscore > bscore) {
			return `W+${wscore - bscore}`;
		} else {
			return `Jigo`;
		}
	},

	all_dead: function() {
		let ret = [];
		if (!this.has_valid_analysis() || !Array.isArray(this.analysis.ownership)) {
			return ret;
		}
		let board = this.get_board();
		for (let x = 0; x < board.width; x++) {
			for (let y = 0; y < board.height; y++) {
				if (board.state[x][y] === "b" && this.analysis.ownership[x + (y * board.width)] < 0) {
					ret.push(xy_to_s(x, y));
				} else if (board.state[x][y] === "w" && this.analysis.ownership[x + (y * board.width)] > 0) {
					ret.push(xy_to_s(x, y));
				}
			}
		}
		return ret;
	},

	all_empty: function() {
		let ret = [];
		let board = this.get_board();
		for (let x = 0; x < board.width; x++) {
			for (let y = 0; y < board.height; y++) {
				if (board.state[x][y] === "") {
					ret.push(xy_to_s(x, y));
				}
			}
		}
		return ret;
	},

	dame: function() {

		// Note that we rather assume we are at the game end. We also need ownership data.

		let ret = [];

		if (!this.has_valid_analysis() || !Array.isArray(this.analysis.ownership)) {
			return ret;
		}

		// First, find all points which are either empty, or would be empty if dead stones were removed...

		let todo = Object.create(null);
		Object.assign(todo, array_to_set(this.all_empty()));
		Object.assign(todo, array_to_set(this.all_dead()));

		// Now find areas of connected "empty" points, and check whether any of their neighbours are
		// living Black or White stones... if the area sees both, they are dame points.

		let board = this.get_board();

		while (true) {

			let todo_keys = Object.keys(todo);
			if (todo_keys.length === 0) {
				break;
			}

			let start_point = todo_keys[0];

			let space = [];			// All "empty" intersections connected to the start point.

			space.push(start_point);
			delete todo[start_point];

			let sees_black = false;
			let sees_white = false;

			for (let i = 0; i < space.length; i++) {

				// This is kind of a trick, space.length is increasing during the loop.

				let point = space[i];

				let neighbours = board.neighbours(point);

				for (let neighbour of neighbours) {
					if (todo[neighbour]) {
						space.push(neighbour);
						delete todo[neighbour];
					} else {
						let x = neighbour.charCodeAt(0) - 97;
						let y = neighbour.charCodeAt(1) - 97;
						if (board.state[x][y] === "b") {
							if (this.analysis.ownership[x + (y * board.width)] > 0) {
								sees_black = true;
							}
						}
						if (board.state[x][y] === "w") {
							if (this.analysis.ownership[x + (y * board.width)] < 0) {
								sees_white = true;
							}
						}
					}
				}
			}

			if (sees_black && sees_white) {
				for (let point of space) {
					ret.push(point);
				}
			}
		}

		return ret;
	},

	score_japanese: function() {
		return this.score(true);
	},

	score_chinese: function() {
		return this.score(false);
	},

	// Some debugging functions to access those 1 dimensional arrays KataGo sends us...............

	policy_from_s: function(s) {				// "pd" --> this.analysis.policy[72]
		if (!this.has_valid_analysis()) {
			return null;
		}
		if (!Array.isArray(this.analysis.policy)) {
			return null;
		}
		let board = this.get_board();
		if (!board.in_bounds(s)) {
			if (s !== "" && s !== "pass") {
				return null;
			} else {
				return this.analysis.policy[this.analysis.policy.length - 1];
			}
		}
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		let i = y * board.width + x;
		return this.analysis.policy[i];
	},

	policy_from_gtp: function(s) {				// "Q16" --> this.analysis.policy[72]
		s = this.get_board().parse_gtp_move(s);
		return this.policy_from_s(s);
	},

	ownership_from_s: function(s) {				// For debugging only. "pd" --> this.analysis.ownership[72]
		if (!this.has_valid_analysis()) {
			return null;
		}
		if (!Array.isArray(this.analysis.ownership)) {
			return null;
		}
		let board = this.get_board();
		if (!board.in_bounds(s)) {
			return null;
		}
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		let i = y * board.width + x;
		return this.analysis.ownership[i];
	},

	ownership_from_gtp: function(s) {			// For debugging only. "Q16" --> this.analysis.ownership[72]
		s = this.get_board().parse_gtp_move(s);
		return this.ownership_from_s(s);
	},

};



