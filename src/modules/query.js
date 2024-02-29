"use strict";

// There are some issues around generating a query when the history has mid-game board edits. We handle these
// by specifying an "initial" position (generated from the latest edit node), but this has the following issues:
//
// 1. KataGo has no way to know how many prisoners there were in this "initial" position, which means it will
// miscount the score under Japanese rules. We deal with this by manually adjusting komi.
//
// 2. KataGo has no way to know how many handicap stones there were at the start, which means it will miscount
// the score under Chinese rules. We don't deal with this at all.

const {node_id_from_search_id, compare_versions} = require("./utils");

const default_maxvisits = 1000000;
const fast_maxvisits = 5;										// What the hub will ask for when in play policy mode.

let next_query_id = 1;

function new_query(query_node, eng_version = null, maxvisits = null, avoid = null) {

	if (typeof maxvisits !== "number") {						// Things will likely send null / undefined when not specifying.
		maxvisits = default_maxvisits;
	}

	if (!Array.isArray(avoid)) {
		avoid = [];
	}

	if (maxvisits < 2) {
		maxvisits = 2;											// Don't use 1, I think it only visits the root and doesn't suggest a move.
	}

	let board = query_node.get_board();

	let want_ownership = (typeof config.ownership_marks === "number" && config.ownership_marks !== 0);

	let o = {
		id: `${query_node.id}:${next_query_id++}`,
		rules: query_node.rules() || config.default_rules,
		komi: query_node.komi(),
		boardXSize: board.width,
		boardYSize: board.height,
		maxVisits: maxvisits,
		analysisPVLen: 32, 										// Was (config.analysis_pv_len - 1) but why not ask for whatever's available...
		reportDuringSearchEvery: config.report_every,
		avoidMoves: [],
		includePolicy: true,
		includeOwnership: true,
		includeMovesOwnership: (want_ownership && config.ownership_per_move) ? true : false,

		overrideSettings: {
			reportAnalysisWinratesAs: "BLACK",
			wideRootNoise: config.wide_root_noise,
		}
	};

	if (maxvisits <= fast_maxvisits) {
		delete o.reportDuringSearchEvery;
	}

	if (avoid.length === 0) {
		delete o.avoidMoves;
	} else {
		o.avoidMoves = [{
			player: board.active.toUpperCase(),
			moves: [],
			untilDepth: 1,
		}];
		for (let s of avoid) {
			o.avoidMoves[0].moves.push(board.gtp(s));
		}
	}

	// Some features of KataGo were added along the way, only set those if the engine version is adequate...

	if (eng_version && compare_versions(eng_version, [1,12,0]) >= 0) {
		if (config.fast_first_report && maxvisits > fast_maxvisits) {
			o.firstReportDuringSearchAfter = 0.05;
		}
	}

//	if (eng_version && compare_versions(eng_version, [1,14,0]) >= 0) {
//		o.overrideSettings.ignorePreRootHistory = true;						// Eh I guess just allow user to config this via file.
//	}

	// -----------------------------------------------------------------------------------------------------------------------------------------------
	// Whatever else we do, we make sure that KataGo will analyse from the POV of (query_node.get_board().active).

	o.initialStones = [];
	o.moves = [];

	for (let node of query_node.history_reversed()) {

		if (node.has_key("AB") || node.has_key("AW") || node.has_key("AE") || node.move_count() > 1) {

			// This node will serve as the setup position.
			// Note that stones from any B or W properties will be included in the setup.
			// Note that in territory rules, we need to adjust komi to account for captures (info which is lost when sending a setup position).

			o.initialStones = node.get_board().setup_list();
			if (o.rules.toLowerCase() === "japanese" || o.rules.toLowerCase() === "korean") {
				o.komi -= node.get_board().caps_balance();
			}
			break;

		} else if (node.move_count() === 1) {

			let key = node.has_key("B") ? "B" : "W";
			let s = node.get(key);

			// If the stone overwrites a previously-existing stone we will have to make this the setup position as above.

			if (node.parent && node.parent.get_board().state_at(s)) {
				o.initialStones = node.get_board().setup_list();
				if (o.rules.toLowerCase() === "japanese" || o.rules.toLowerCase() === "korean") {
					o.komi -= node.get_board().caps_balance();
				}
				break;
			}

			// The final move (i.e. the first one we see) will determine what colour KataGo plays but if
			// query_node.get_board().active is the unnatural player instead, we will need to use a setup.

			if (o.moves.length === 0) {
				if ((key === "B" && query_node.get_board().active === "b") || (key === "W" && query_node.get_board().active === "w")) {
					o.initialStones = query_node.get_board().setup_list();
					if (o.rules.toLowerCase() === "japanese" || o.rules.toLowerCase() === "korean") {
						o.komi -= query_node.get_board().caps_balance();
					}
					break;
				}
			}

			// But normally, this node can be included in the moves list.

			o.moves.push([key, node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds.

		}
	}

	o.moves.reverse();

	if (o.moves.length === 0) {
		o.initialPlayer = query_node.get_board().active.toUpperCase();
	}

	return o;
}


function compare_queries(a, b) {

	let a_keys = Object.keys(a).sort();			// Sorting is important...
	let b_keys = Object.keys(b).sort();

	if (a_keys.length !== b_keys.length) {
		return false;
	}

	for (let i = 0; i < a_keys.length; i++) {
		let key = a_keys[i];
		if (b_keys[i] !== key) {
			return false;
		}
		if (["id", "overrideSettings", "initialStones", "moves", "avoidMoves"].includes(key)) {
			continue;
		}
		if (a[key] !== b[key]) {
			return false;
		}
	}

	if (node_id_from_search_id(a.id) !== node_id_from_search_id(b.id)) {
		return false;
	}

	for (let key of Object.keys(a.overrideSettings)) {
		if (a.overrideSettings[key] !== b.overrideSettings[key]) {
			return false;
		}
	}

	if (!compare_moves_arrays(a.initialStones, b.initialStones)) {
		return false;
	}

	if (!compare_moves_arrays(a.moves, b.moves)) {
		return false;
	}

	if (Array.isArray(a.avoidMoves) !== Array.isArray(b.avoidMoves)) {
		return false;
	}

	if (Array.isArray(a.avoidMoves) && Array.isArray(b.avoidMoves)) {
		if (!compare_avoid_arrays(a.avoidMoves, b.avoidMoves)) {
			return false;
		}
	}

	return true;
}


function compare_moves_arrays(arr1, arr2) {			// Works for initialStones as well.

	if (arr1.length !== arr2.length) {
		return false;
	}

	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i][0] !== arr2[i][0] || arr1[i][1] !== arr2[i][1]) {
			return false;
		}
	}

	return true;
}


function compare_avoid_arrays(arr1, arr2) {

	if (arr1.length !== arr2.length) {
		return false;
	}

	// The arrays will either be of length 0 or length 1...
	// (the only dict in a length 1 array contains its own (possibly long) array.

	if (arr1.length === 0) {
		return true;
	}

	if (arr1[0].moves.length !== arr2[0].moves.length) {
		return false;
	}

	// Ideally we would consider the arrays the same if they had the same moves
	// in a different order, but meh, this is good enough...

	for (let i = 0; i < arr1[0].moves.length; i++) {
		if (arr1[0].moves[i] !== arr2[0].moves[i]) {
			return false;
		}
	}

	return true;
}


module.exports = {default_maxvisits, fast_maxvisits, new_query, compare_queries, compare_moves_arrays};
