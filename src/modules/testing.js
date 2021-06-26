"use strict";

let testpos = `(;SZ[19]KM[5.5]RE[W+R]RU[Japanese]
;B[qd];W[dc];B[cp];W[pp];B[nq];W[ep];B[gq];W[fo];B[cm];W[hp];B[qn];W[pn];B[pm];W[on]
;B[qo];W[qp];B[kp];W[pk];B[po];W[oo];B[op];W[om];B[qm];W[pl];B[rp];W[rq];B[qq];W[pq]
;B[qr];W[ro];B[sp];W[sq];B[pr];W[so];B[rp];W[sp];B[oq];W[rp];B[rl];W[rk];B[rr])
`;

exports.load = function() {
	hub.load_sgf_from_string(testpos);
};

// ------------------------------------------------------------------------------------------------

function stresser(i, n, cycles, delay, backwards, results, last_call_time) {

	// i - current step, initial call should be 0
	// n - how many steps in cycle

	let this_call_time = performance.now();
	results.push(this_call_time - last_call_time);

	if (backwards) {
		hub.prev();
	} else {
		hub.next();
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
