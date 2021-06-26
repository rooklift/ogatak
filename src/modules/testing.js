"use strict";

let testpos = `(;SZ[19]KM[5.5]RE[W+R]RU[Japanese];B[pd];W[dc];B[pp];W[ep];B[cf];W[cd];B[ci];W[nc];B[qf];W[pb]
(;B[cq];W[do];B[er];W[cp];B[dq];W[ck];B[qc];W[kc];B[gq];W[ek](;B[nq];W[go];B[ef];W[gd];B[ei];W[pk];B[ip];W[in];B[ko];W[qn]
(;B[qi];W[mp];B[mn];W[np];B[mq];W[kp];B[lp];W[oq];B[or];W[op](;B[pq];W[pr];B[nr];W[po];B[qr];W[lo];B[lq];W[ln];B[mo];W[on]
(;B[lm];W[kn];B[km];W[jn];B[nl];W[oj];B[lj];W[ik];B[rp];W[rj](;B[ri];W[ni];B[oo];W[no];B[nn];W[oo];B[om];W[pm];B[qo];W[pn]
(;B[rn];W[pl];B[mj];W[lh];B[jj];W[ne];B[ij];W[hk];B[jd];W[jc](;B[id];W[jh];B[ic];W[jk];B[hi];W[hg];B[ig];W[ih];B[hh];W[if]
(;B[mh];W[mg];B[gg];W[jg];B[mi];W[nh];B[lg];W[mf];B[kd];W[gf](;B[lc];W[kj];B[ki];W[kk];B[kh];W[kg];B[ji];W[lb];B[gc];W[gh]
(;B[gi];W[fg];B[ej];W[fc];B[hb];W[gb];B[hd];W[hc];B[og];W[ng](;B[gc];W[fb];B[md];W[nd];B[jb];W[kb];B[le];W[lf];B[mb];W[ja]
(;B[cn];W[mm];B[nm];W[ml];B[ib];W[mc];B[la];W[ld];B[ll];W[mk](;B[lc];W[bi];B[ge];W[ch];B[dh];W[cj];B[ka];W[di];B[fk];W[el]
(;B[eg];W[fh];B[eh];W[fd];B[fl];W[em];B[fi];W[hj];B[lk];W[ii])(;B[fe]))(;B[lk]))(;B[fk]))(;B[fk]))(;B[nj]))(;B[fg]))
(;B[jg]))(;B[kh]))(;B[pl]))(;B[kd]))(;B[kn]))(;B[pr]))(;B[pn]))(;B[qn]))(;B[cp]))
`;

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

