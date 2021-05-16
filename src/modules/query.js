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

exports.full_query_matches_base = function(full, base) {

	if (!full.moves || base.moves) {
		throw "full_query_matches_base(): bad call";			// Probably wrong-way-round
	}

	for (let key of Object.keys(base)) {
		if (key === "overrideSettings" || key === "id") {
			continue;
		}
		if (full[key] !== base[key]) {
			return false;
		}
	}

	if (node_id_from_search_id(full.id) !== node_id_from_search_id(base.id)) {
		return false;
	}

	for (let key of Object.keys(base.overrideSettings)) {
		if (full.overrideSettings[key] !== base.overrideSettings[key]) {
			return false;
		}
	}

	return true;
};
