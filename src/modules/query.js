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

let next_query_id = 1;

function new_query(query_node, engine) {

	// Every key that's used at all should be in 100% of the queries, even for default values.

	let board = query_node.get_board();

	let want_ownership = (typeof config.ownership_marks === "number" && config.ownership_marks !== 0);

	let o = {

		id: `${query_node.id}:${next_query_id++}`,
		
		rules: (board.rules === "Unknown") ? config.default_rules : board.rules,
		komi: board.komi,
		boardXSize: board.width,
		boardYSize: board.height,
		maxVisits: 1000000,
		analysisPVLen: 32, 										// Was (config.analysis_pv_len - 1) but why not ask for whatever's available...
		reportDuringSearchEvery: config.report_every,
		includeOwnership: (want_ownership) ? true : false,
		includeMovesOwnership: (want_ownership && config.ownership_per_move) ? true : false,

		overrideSettings: {										// REMEMBER to add new (post-1.9.1) features to the deletions below.
			reportAnalysisWinratesAs: "BLACK",
			wideRootNoise: config.wide_root_noise,
			rootSymmetryPruning: (config.symmetry_pruning) ? true : false,
		}
	};

	// Before KataGo 1.9.1, it would generate an error for unknown fields in the settings.
	// So if the engine is earlier than that, strip out fields it hasn't heard of.

	if (!engine.is_gtp) {
		if (compare_versions(engine.version, [1,9,1]) === -1) {
			delete o.overrideSettings.rootSymmetryPruning;		// Introduced in 1.9.0 but that's a crashy version anyway, so the 1.9.1 check is fine.
		}
	}

	// -----------------------------------------------------------------------------------------------------------------------------------------------
	// Whatever else we do, we make sure that KataGo will analyse from the POV of (query_node.get_board().active).

	o.initialStones = [];
	o.moves = [];

	for (let node of query_node.history_reversed()) {

		let nodemovecount = (node.has_key("B") ? node.props.B.length : 0) + (node.has_key("W") ? node.props.W.length : 0);

		if (node.has_key("AB") || node.has_key("AW") || node.has_key("AE") || nodemovecount > 1) {

			// This node will serve as the setup position.
			// Note that stones from any B or W properties will be included in the setup.
			// Note that in territory rules, we need to adjust komi to account for captures (info which is lost when sending a setup position).

			o.initialStones = node.get_board().setup_list();
			if (o.rules.toLowerCase() === "japanese" || o.rules.toLowerCase() === "korean") {
				o.komi -= node.get_board().caps_balance();
			}

			break;

		} else if (nodemovecount === 1) {

			// The final move (i.e. the first one we see) will determine what colour KataGo plays but if
			// query_node.get_board().active is the unnatural player instead, we will need to use a setup.

			if (o.moves.length === 0) {
				if ((node.has_key("B") && query_node.get_board().active === "b") || (node.has_key("W") && query_node.get_board().active === "w")) {
					o.initialStones = query_node.get_board().setup_list();
					if (o.rules.toLowerCase() === "japanese" || o.rules.toLowerCase() === "korean") {
						o.komi -= query_node.get_board().caps_balance();
					}
					break;
				}
			}

			// But normally, this node can be included in the moves list.

			if (node.has_key("B")) {
				let s = node.get("B");
				o.moves.push(["B", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds.
			}
			if (node.has_key("W")) {
				let s = node.get("W");
				o.moves.push(["W", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds.
			}

		}
	}

	o.moves.reverse();

	if (o.moves.length === 0) {
		o.initialPlayer = query_node.get_board().active.toUpperCase();
	}

	return o;
}


function compare_queries(a, b) {

	for (let key of Object.keys(a)) {

		if (["id", "overrideSettings", "initialStones", "moves"].includes(key)) {
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



module.exports = {new_query, compare_queries, compare_moves_arrays};
