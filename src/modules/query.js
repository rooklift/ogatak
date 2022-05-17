"use strict";

const {node_id_from_search_id, compare_versions} = require("./utils");

let next_query_id = 1;

function new_query(query_node, engine) {

	// A base query without the expensive things.
	// Every key that's used at all should be in 100% of the queries, even for default values.

	let board = query_node.get_board();

	let want_ownership = (typeof config.ownership_marks === "string" && config.ownership_marks !== "None");		// Lame stringly typed var...

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
			wideRootNoise: (config.widerootnoise) ? 0.04 : 0,
			rootSymmetryPruning: (config.symmetry_pruning) ? true : false,
		}
	};

	// Before KataGo 1.9.1, it would generate an error for unknown fields in the settings.
	// So if the engine is earlier than that, strip out fields it hasn't heard of.

	if (compare_versions(engine.version, [1,9,1]) === -1) {
		delete o.overrideSettings.rootSymmetryPruning;			// Introduced in 1.9.0 but that's a crashy version anyway, so the 1.9.1 check is fine.
	}

	// -----------------------------------------------------------------------------------------------------------------------------------------------
	// Whatever else we do, we make sure that KataGo will analyse from the POV of (query_node.get_board().active).

	let setup = [];
	let moves = [];

	for (let node of query_node.history_reversed()) {

		let nodemovecount = (node.has_key("B") ? node.props.B.length : 0) + (node.has_key("W") ? node.props.W.length : 0);

		if (node.has_key("AB") || node.has_key("AW") || node.has_key("AE") || nodemovecount > 1) {

			// This node will serve as the setup position.
			// Note that stones from any B or W properties will be included in the setup.

			setup = node.get_board().setup_list();
			break;

		} else if (nodemovecount === 1) {

			// The final move (i.e. the first one we see) will determine what colour KataGo plays but if
			// query_node.get_board().active is the unnatural player instead, we will need to use a setup.

			if (moves.length === 0) {
				if ((node.has_key("B") && query_node.get_board().active === "b") || (node.has_key("W") && query_node.get_board().active === "w")) {
					setup = query_node.get_board().setup_list();
					break;
				}
			}

			// But normally, this node can be included in the moves list.

			if (node.has_key("B")) {
				let s = node.get("B");
				moves.push(["B", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds.
			}
			if (node.has_key("W")) {
				let s = node.get("W");
				moves.push(["W", node.get_board().gtp(s)]);		// Sends "pass" if s is not in-bounds.
			}

		}
	}

	moves.reverse();

	o.initialStones = setup;
	o.moves = moves;

	if (moves.length === 0) {
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

		if (arr1[i][0] !== arr2[i][0]) {
			return false;
		}

		if (arr1[i][1] !== arr2[i][1]) {
			return false;
		}
	}

	return true;
}



module.exports = {new_query, compare_queries};
