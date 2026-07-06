"use strict";

// Given anything, create a string from it.
// Helps with sending messages over IPC, displaying alerts, etc.

module.exports = (msg) => {
	if (typeof msg === "string") {
		return msg.trim();
	}
	let str;
	try {
		if (msg instanceof Error) {
			str = String(msg);									// Error objects (same-realm only)
		} else if (msg !== null && typeof msg === "object") {
			try {
				str = JSON.stringify(msg) ?? String(msg);		// Other (normal) objects. The ?? handles foo.toJSON() -> undefined
			} catch {
				str = String(msg);								// JSON.stringify threw: circular, toJSON() -> throw, BigInt value inside, too deep
			}
		} else {
			str = String(msg);									// null, undefined, number, boolean, symbol, bigint, function
		}
	} catch {
		try {
			str = Object.prototype.toString.call(msg);			// String() threw (e.g. circular null-proto object), or instanceof trapped (proxy)
		} catch {
			str = "[unstringifiable " + typeof msg + "]";		// hostile / revoked proxies
		}
	}
	return str.trim();
};
