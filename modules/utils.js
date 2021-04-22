"use strict";

exports.XYtoS = function(x, y) {

	if (x < 0 || x > 25 || y < 0 || y > 25) {
		return "";
	}

	return String.fromCharCode(x + 97) + String.fromCharCode(y + 97);
}

exports.EventPathString = function(event, prefix) {

	// Given an event with event.path like ["foo", "bar", "searchmove_e2e4", "whatever"]
	// return the string "e2e4", assuming the prefix matches. Else return null.

	if (!event || typeof prefix !== "string") {
		return null;
	}

	let path = event.path || (event.composedPath && event.composedPath());

	if (path) {
		for (let item of path) {
			if (typeof item.id === "string") {
				if (item.id.startsWith(prefix)) {
					return item.id.slice(prefix.length);
				}
			}
		}
	}

	return null;
}
