"use strict";

const {node_id_from_search_id} = require("./utils");

let next_query_id = 1;

exports.base_query = function(node) {

	// A base query without the expensive things.
	// Every key that's used at all should be in 100% of the queries, even for default values.

	let board = node.get_board();

	let o = {};

	o.id = `${node.id}:${next_query_id++}`;

	o.rules = board.rules === "Unknown" ? config.default_rules : board.rules;
	o.komi = board.komi;
	o.boardXSize = board.width;
	o.boardYSize = board.height;

	o.maxVisits = 1000000;
	o.reportDuringSearchEvery = 0.1;

	o.includeOwnership = config.dead_stone_prediction ? true : false;
	o.includeMovesOwnership = config.dead_stone_prediction ? true : false;

	o.overrideSettings = {
		reportAnalysisWinratesAs: "SIDETOMOVE",
		wideRootNoise: config.widerootnoise ? 0.05 : 0,
	};

	return o;
};

exports.full_query = function(query_node) {

	let o = exports.base_query(query_node);

	let setup = [];
	let moves = [];

	for (let node of this.history_reversed()) {

		let totalmoves = (node.props.B ? node.props.B.length : 0) + (node.props.W ? node.props.W.length : 0);

		if (node.props.AB || node.props.AW || node.props.AE || totalmoves > 1) {

			// In this case, our final object will have only moves after this node, but will set up the
			// position at this node. Note that any moves in this node (from properties B and W) will be
			// included in the setup position, thus we break here so they aren't also in the moves list.

			setup = node.get_board().setup_list();
			break;
		}

		if (totalmoves === 1) {
			if (node.props.B) {
				let s = node.get("B");
				moves.push(["B", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds;
			}
			if (node.props.W) {
				let s = node.get("W");
				moves.push(["W", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds;
			}
		}
	}

	moves.reverse();

	o.initialStones = setup;
	o.moves = moves;

	if (moves.length === 0) {
		o.initialPlayer = this.get_board().active.toUpperCase();
	}

	return o;
};

exports.full_query_matches_base = function(full, base) {

	if (!full.moves || base.moves) {
		throw "full_query_matches_base(): bad call";			// Probably wrong-way-round
	}

	for (let key of Object.keys(base)) {
		if (key === "overrideSettings" || key === "id") {
			continue;
		}
		if (base[key] !== full[key]) {
			return false;
		}
	}

	if (node_id_from_search_id(full.id) !== node_id_from_search_id(base.id)) {
		return false;
	}

	for (let key of Object.keys(base.overrideSettings)) {
		if (base.overrideSettings[key] !== full.overrideSettings[key]) {
			return false;
		}
	}

	return true;
};
