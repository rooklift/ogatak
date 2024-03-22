"use strict";

// Various stuff for debugging, etc...
// These methods get added to the Node prototype.

module.exports = {

	score: function(jp = false) {								// Note that we rather assume we are at the game end.

		if (!this.has_valid_analysis() || !Array.isArray(this.analysis.ownership)) {
			return "No ownership data";
		}

		let board = this.get_board();

		let cap_value = jp ? 1 : 0;
		let stn_value = jp ? 0 : 1;

		let bscore = 0;
		let wscore = 0;

		for (let x = 0; x < board.width; x++) {
			for (let y = 0; y < board.height; y++) {
				let own = this.analysis.ownership[x + (y * board.width)];
				if (own > 0.9) {
					if (board.state[x][y] === "") {
						bscore += 1;							// My territory
					} else if (board.state[x][y] === "w") {
						bscore += 1 + cap_value;				// My territory containing opponent's dead stone
					} else if (board.state[x][y] === "b") {
						bscore += stn_value;					// My living stone
					}
				} else if (own < -0.9) {
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



