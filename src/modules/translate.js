"use strict";

const startup_language = config.language;
const translations = require("./translations");

function translate(key, force_language = null) {

	// Note that we usually use the language which was in config.json at startup so
	// that in-flight calls to translate() return consistent results even if the user
	// switches config.language at some point. (Thus, the user will need to restart
	// to see any change.)

	let language = force_language || startup_language;

	if (translations[language] && translations[language][key]) {
		return translations[language][key];
	} else if (translations["English"] && translations["English"][key]) {
		return translations["English"][key];
	} else {
		return key;
	}

}

function all_translators() {
	let set = Object.create(null);
	for (let dict of Object.values(translations)) {
		if (dict["TRANSLATION_BY"]) {
			set[dict["TRANSLATION_BY"]] = true;
		}
	}
	return Object.keys(set);
}

function all_strings(language, with_english) {
	let arr = [];
	for (let [key, value] of Object.entries(translations[language])) {
		arr.push(value);
		if (with_english) {
			arr[arr.length - 1] += " (" + translations["English"][key] + ")";
		}
	}
	return arr;
}

function missing_keys(language) {
	let arr = [];
	for (let key of Object.keys(translations["English"])) {
		if (!translations[language].hasOwnProperty(key)) {
			arr.push(key);
		}
	}
	return arr;
}

function count_all_missing() {
	let ret = {};
	for (let key of Object.keys(translations["English"])) {
		for (let language of Object.keys(translations)) {
			if (!translations[language].hasOwnProperty(key)) {
				if (ret[language]) {
					ret[language] += 1;
				} else {
					ret[language] = 1;
				}
			}
		}
	}
	return ret;
}

function all_languages() {
	return Object.keys(translations);
}

// Validate dictionaries... (every key should be in the English version)

for (let language of Object.keys(translations)) {
	for (let key of Object.keys(translations[language])) {
		if (!translations["English"].hasOwnProperty(key)) {
			throw new Error(`Bad key (${key}) in language dictionary ${language}`);
		}
	}
}



module.exports = {translate, all_translators, all_strings, missing_keys, count_all_missing, all_languages};
