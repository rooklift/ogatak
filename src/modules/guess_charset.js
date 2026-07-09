"use strict";

// If something isn't UTF-8, what would it be?
//
// Method: decode some of the buffer with each candidate decoder and score the result by what
// Unicode characters come out. Text decoded with the right charset produces characters from
// the script the charset was designed for (e.g. kana for Japanese, hangul for Korean,
// Cyrillic for Russian) while text decoded with a wrong charset tends to produce replacement
// characters, control characters, floods of halfwidth katakana, or -- the tricky case --
// valid-but-wrong CJK ideographs (GBK / Big5 / EUC-KR / EUC-JP can often decode each other's
// bytes into plausible ideographs). Hence ideographs score low, script-specific characters
// score high, and each candidate penalises characters its own language wouldn't really produce.

const decoders = require("./decoders");

const candidates = [		// In priority order - ties are won by the earlier candidate.
	{charset: "shift_jis",		kana:  6,	hangul: -2,		han:  2,	cyrillic: -2,	needs_kana: false},
	{charset: "euc-jp",			kana:  6,	hangul: -2,		han:  2,	cyrillic: -2,	needs_kana: true},		// Needs kana, else GBK text can decode as EUC-JP.
	{charset: "euc-kr",			kana: -2,	hangul:  3,		han: -1,	cyrillic: -2,	needs_kana: false},
	{charset: "gbk",			kana: -2,	hangul: -2,		han:  2,	cyrillic: -2,	needs_kana: false},		// Note: GBK is a superset of GB2312.
	{charset: "big5",			kana: -2,	hangul: -2,		han:  2,	cyrillic: -2,	needs_kana: false},
	{charset: "windows-1252",	kana: -2,	hangul: -2,		han: -2,	cyrillic: -2,	needs_kana: false},		// Before the Cyrillic charsets, so that a lone
	{charset: "windows-1251",	kana: -2,	hangul: -2,		han: -2,	cyrillic:  3,	needs_kana: false},		// accented letter (which ties) stays Latin.
	{charset: "koi8-r",			kana: -2,	hangul: -2,		han: -2,	cyrillic:  3,	needs_kana: false},
];

const CLOSER_SCORE = 6;

function guess_charset(buf, limit) {

	if (buf.length > limit) {
		buf = buf.subarray(0, limit);
	}

	let best = null;
	let best_score = 0;

	// We now adjust the minimal acceptable score to count apparently meaningful ] characters,
	// we don't expect to lose too many of these...

	let prev_was_backslash = false;
	for (let c of buf) {
		if (c === 93 && !prev_was_backslash) {
			best_score += CLOSER_SCORE;
		}
		prev_was_backslash = c === 92;
	}

	for (let candidate of candidates) {
		if (!decoders.available(candidate.charset)) {
			continue;
		}
		let score = score_buf(buf, candidate);
		if (score > best_score) {
			best = candidate.charset;
			best_score = score;
		}
	}

	return best;				// Can still be null
}

function score_buf(buf, candidate) {

	let score = 0;
	let kana_seen = false;
	let rank_seen = false;
	let prev_was_latin = false;
	let prev_was_letter = false;
	let prev_was_backslash = false;
	let prev_was_cyrillic = false;
	let prev_was_cyrillic_lower = false;
	let prev_was_hangul = false;
	let prev_was_han = false;
	let prev_char_score = 0;

	let rank_tag_progress = 0;

	let dec = decoders.get_decoder(candidate.charset);
	let s = dec.decode(buf, {stream: true});								// In streaming mode, means partial character at end is ignored.
	dec.decode();															// Final non-streaming decode to flush the decoder, leaving it in a clean state.

	for (let ch of s) {

		let cp = ch.codePointAt(0);
		let this_is_latin = false;
		let this_is_cyrillic = false;
		let this_is_cyrillic_lower = false;
		let this_is_hangul = false;
		let this_is_han = false;
		let this_char_score = 0;											// What this char scored, recorded for possible retraction below.

		if (prev_char_score > 0 && ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122))) {
			score -= prev_char_score;										// A CJK or Cyrillic character directly followed by an ASCII letter
		}																	// is how a word-initial accented Latin byte looks when decoded by
																			// the wrong charset, which either eats the following letter too
																			// (e.g. windows-1252 "École" as GBK is "臉ole") or not (windows-1252
																			// "Þór" as windows-1251 is "Юуr"), so retract the score it received.

		if (rank_tag_progress === 0) {
			rank_tag_progress = (ch === "B" || ch === "W") ? 1 : 0;
		} else if (rank_tag_progress === 1) {
			rank_tag_progress = (ch === "R") ? 2 : 0;
		} else if (rank_tag_progress === 2) {
			rank_tag_progress = (ch === "[") ? 3 : 0;
		} else if (rank_tag_progress === 3) {
			if (["初", "一", "二", "三", "四", "五", "六", "七", "八", "九"].includes(ch)) {
				score += 20;
				rank_seen = true;
				rank_tag_progress = 4;										// i.e. stop caring about this. We do it once only.
			} else {
				rank_tag_progress = 0;
			}
		}

		if (cp === 93 && !prev_was_backslash) {								// Unescaped ] characters. As a special case, score these.
			score += CLOSER_SCORE;
		} else if (cp === 0xfffd) {											// Replacement character, i.e. the decoder rejected some bytes.
			score -= 12;
		} else if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) {			// C0 control characters, except tab / LF / CR.
			score -= 6;
		} else if (cp >= 0x80 && cp <= 0x9f) {								// C1 control characters.
			score -= 6;
		} else if (cp >= 0x3040 && cp <= 0x30ff) {							// Hiragana and katakana.
			score += candidate.kana;
			kana_seen = true;
		} else if ((cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f)) {	// Hangul.
			this_is_hangul = true;											// Hangul adjacent to an ideograph is a sign of a wrong decode:
			if (prev_was_han) {												// real Korean text is nearly all hangul (with hanja, if any, set
				score -= 4;													// off in clusters like names), whereas GBK / Big5 bytes decoded
			} else {														// as EUC-KR give the two scripts chaotically interleaved.
				score += candidate.hangul;
				this_char_score = candidate.hangul;
			}
		} else if (cp >= 0x4e00 && cp <= 0x9fff) {							// CJK ideographs. An ideograph right after an ASCII letter is how
			this_is_han = true;												// accented Latin bytes look when decoded as a CJK charset (e.g.
			if (prev_was_hangul) {											// windows-1252 "Müller" as GBK is "M黮ler") so those don't score,
				score -= 4;													// and one right after hangul is penalised as described above.
			} else if (!prev_was_letter) {
				score += candidate.han;
				this_char_score = candidate.han;
			}
		} else if (cp >= 0x0400 && cp <= 0x045f) {							// Cyrillic. The two Cyrillic charsets have opposite case layouts,
			this_is_cyrillic = true;										// so each decodes typical (mostly lowercase) text in the other as
			this_is_cyrillic_lower = (cp >= 0x0430);						// mostly UPPERCASE -- hence only lowercase gets the full score.
			if (!this_is_cyrillic_lower && prev_was_cyrillic_lower) {		// Real Cyrillic text never flips to uppercase mid-word, but CJK
				score -= 6;													// bytes decoded as a Cyrillic charset give randomly mixed case,
			} else if (!prev_was_letter) {									// so such flips are penalised. (The prev_was_letter check is as
				if (this_is_cyrillic_lower && prev_was_cyrillic) {			// for ideographs: e.g. "Müller" as windows-1251 is "Mьller".)
					score += candidate.cyrillic;							// Also, the full score needs a Cyrillic run: real Russian text
					this_char_score = candidate.cyrillic;					// comes in whole words of it, whereas stray accented Latin
				} else {													// letters decoded as Cyrillic are isolated singles.
					score += Math.min(candidate.cyrillic, 1);
					this_char_score = Math.min(candidate.cyrillic, 1);
				}
			}
		} else if (cp >= 0x2500 && cp <= 0x25ff) {							// Box drawing and geometric shapes, a sign of a wrong decode
			score -= 2;														// (KOI8-R is full of them).
		} else if (cp >= 0xff61 && cp <= 0xff9f) {							// Halfwidth katakana, usually a sign of a wrong decode.
			score -= 2;
		} else if ((cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6)) {	// CJK punctuation and fullwidth forms.
			score += 1;
			this_char_score = 1;
		} else if (cp >= 0xa0 && cp <= 0x2ff) {								// Latin supplements. Isolated accented letters are a good sign;
			this_is_latin = true;											// long runs of them are how CJK bytes look when decoded as
			if (!prev_was_latin) {											// windows-1252, so only score the first in each run.
				score += 1;
			}
		}

		prev_was_latin = this_is_latin;
		prev_was_letter = (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122);
		prev_was_backslash = cp === 92;
		prev_was_cyrillic = this_is_cyrillic;
		prev_was_cyrillic_lower = this_is_cyrillic_lower;
		prev_was_hangul = this_is_hangul;
		prev_was_han = this_is_han;
		prev_char_score = this_char_score;
	}

	if (candidate.needs_kana && (!kana_seen && !rank_seen)) {
		return 0;
	}

	return score;
}

module.exports = guess_charset;
