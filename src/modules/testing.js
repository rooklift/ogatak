"use strict";

const path = require("path");

let testpos = `(;SZ[19]KM[7.5]RE[W+R]RU[Chinese]
;B[pd];W[dp];B[cd];W[qp];B[op];W[oq];B[nq];W[pq];B[cn];W[fq];B[mp];W[po]
;B[iq];W[ec];B[hd];W[cg];B[ed];W[cj];B[dc];W[bp];B[nc];W[qi];B[ep];W[eo]
;B[dk];W[fp];B[ck];W[dj];B[ej];W[ei];B[fi];W[eh];B[fh];W[bj];B[fk];W[fg]
;B[gg];W[ff];B[gf];W[mc];B[md];W[lc];B[nb];W[id];B[hc];W[jg];B[pj];W[pi]
;B[oj];W[oi];B[ni];W[nh];B[mh];W[ng];B[mg];W[mi];B[nj];W[mf];B[li];W[ne]
;B[nd];W[mj];B[lf];W[mk];B[me];W[nf];B[lh];W[qj];B[kk];W[ik];B[ji];W[gh]
;B[hj];W[ge];B[he];W[fd];B[fc])`;

exports.load = function() {
	hub.load_sgf_from_string(testpos);
};

// ------------------------------------------------------------------------------------------------

function stresser(i, n, cycles, delay, backwards, results, last_call_time) {

	// i - current step, initial call should be 0
	// n - how many steps in cycle

	// This test doesn't exactly match holding the up / down arrows, because it's using setTimeout
	// to repeat, and I suppose there will always be an interleaved call to hub.up_down_spinner(),
	// therefore the hub will never have to drop inputs.

	let this_call_time = performance.now();
	results.push(this_call_time - last_call_time);

	if (backwards) {
		hub.input_up_down(-1);
	} else {
		hub.input_up_down(1);
	}

	if (i < n - 1) {
		setTimeout(() => {
			stresser(i + 1, n, cycles, delay, backwards, results, this_call_time);
		}, delay);
	} else if (cycles > 1) {
		setTimeout(() => {
			stresser(0, n, cycles - 1, delay, !backwards, results, this_call_time);
		}, delay);
	} else {
		hub.halt();
		console.log("Total calls...", results.length);
		console.log("Worst 10...", results.sort((a, b) => b - a).slice(0, 10).map(n => Math.floor(n * 10) / 10));
	}
}

exports.stress = function(moves, cycles, delay) {
	if (moves === undefined || cycles === undefined || delay === undefined) {
		throw "Bad call";
	}
	hub.go_to_root();
	hub.go();
	stresser(0, moves, cycles, delay, false, [], performance.now());
};

exports.speedtest = function(visits) {

	hub.halt();
	hub.clear_cache();
	hub.forget_analysis_tree();
	hub.go_to_end();
	hub.go();

	let starttime = performance.now();

	let checker = () => {
		if (hub.node && hub.node.has_valid_analysis() && hub.node.analysis.rootInfo.visits > visits) {
			console.log(`${path.basename(config.engine)}: ${visits} visits took ${(performance.now() - starttime).toFixed(0)} ms.`);
			hub.halt();
		} else {
			setTimeout(checker, 100);
		}
	};

	checker();
};

