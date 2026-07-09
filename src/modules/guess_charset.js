"use strict";

// If something isn't UTF-8, what would it be?
//
// Method: decode the whole buffer with each candidate decoder and score the result by what
// Unicode characters come out. Text decoded with the right charset produces characters from
// the script the charset was designed for (e.g. kana for Japanese, hangul for Korean) while
// text decoded with a wrong charset tends to produce replacement characters, control
// characters, floods of halfwidth katakana, or -- the tricky case -- valid-but-wrong CJK
// ideographs (GBK / Big5 / EUC-KR / EUC-JP can often decode each other's bytes into
// plausible ideographs). Hence ideographs score low, script-specific characters score high,
// and each candidate penalises characters its own language wouldn't really produce.

const decoders = require("./decoders");

const candidates = [		// In priority order - ties are won by the earlier candidate.
	{charset: "shift_jis",		kana:  6,	hangul: -2,		han:  2,	needs_kana: false},
	{charset: "euc-jp",			kana:  6,	hangul: -2,		han:  2,	needs_kana: true},		// Without the kana requirement, GBK
	{charset: "euc-kr",			kana: -2,	hangul:  3,		han: -1,	needs_kana: false},		// text can decode "cleanly" as EUC-JP.
	{charset: "gbk",			kana: -2,	hangul: -2,		han:  2,	needs_kana: false},
	{charset: "big5",			kana: -2,	hangul: -2,		han:  2,	needs_kana: false},
	{charset: "windows-1252",	kana: -2,	hangul: -2,		han: -2,	needs_kana: false},
];

function guess_charset(buf) {

	let best = null;
	let best_score = 0;

	for (let candidate of candidates) {
		if (!decoders.available(candidate.charset)) {
			continue;
		}
		let s = decoders.get_decoder(candidate.charset).decode(buf);
		let score = score_string(s, candidate);
		if (score > best_score) {
			best = candidate.charset;
			best_score = score;
		}
	}

	return best;				// Can still be null
}

function score_string(s, candidate) {

	let score = 0;
	let kana_seen = false;
	let prev_was_latin = false;
	let prev_was_letter = false;

	for (let ch of s) {

		let cp = ch.codePointAt(0);
		let this_is_latin = false;

		if (cp === 0xfffd) {												// Replacement character, i.e. the decoder rejected some bytes.
			score -= 12;
		} else if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) {			// C0 control characters, except tab / LF / CR.
			score -= 6;
		} else if (cp >= 0x80 && cp <= 0x9f) {								// C1 control characters.
			score -= 6;
		} else if (cp >= 0x3040 && cp <= 0x30ff) {							// Hiragana and katakana.
			score += candidate.kana;
			kana_seen = true;
		} else if ((cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f)) {	// Hangul.
			score += candidate.hangul;
		} else if (cp >= 0x4e00 && cp <= 0x9fff) {							// CJK ideographs. An ideograph right after an ASCII letter
			if (!prev_was_letter) {											// is how accented Latin bytes look when decoded as a CJK
				score += candidate.han;										// charset (e.g. windows-1252 "Müller" as GBK is "M黮ler"),
			}																// so those don't score.
		} else if (cp >= 0xff61 && cp <= 0xff9f) {							// Halfwidth katakana, usually a sign of a wrong decode.
			score -= 2;
		} else if ((cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6)) {	// CJK punctuation and fullwidth forms.
			score += 1;
		} else if (cp >= 0xa0 && cp <= 0x2ff) {								// Latin supplements. Isolated accented letters are a good sign;
			this_is_latin = true;											// long runs of them are how CJK bytes look when decoded as
			if (!prev_was_latin) {											// windows-1252, so only score the first in each run.
				score += 1;
			}
		}

		prev_was_latin = this_is_latin;
		prev_was_letter = (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122);
	}

	if (candidate.needs_kana && !kana_seen) {
		return 0;
	}

	return score;
}

module.exports = guess_charset;
