"use strict";

// Given anything, create a string from it.
// Helps with sending messages over IPC, displaying alerts, etc.

module.exports = (msg) => {
	if (typeof msg !== "string") {
		try {
			if (msg instanceof Error) {
				msg = msg.toString();
			} else if (typeof msg === "object") {
				msg = JSON.stringify(msg);
			} else if (typeof msg === "undefined") {
				msg = "undefined";
			} else {
				msg = msg.toString();
			}
		} catch (err) {
			return "stringify() failed";
		}
	}
	msg = msg.trim();
	return msg;
};
