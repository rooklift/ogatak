"use strict";

const fs = require("fs");

let logfilename = null;
let stream = null;

module.exports = function(s) {

	// config.logfile - name of desired log file (or null)
	// logfilename    - name of currently open log file (or null)
	// stream         - actual write stream

	if (typeof config.logfile !== "string" || config.logfile === "") {
		if (logfilename) {
			console.log(`Closing ${logfilename}`);
			stream.end();
			logfilename = null;
		}
		return;
	}

	// So at this point, we know config.logfile is some string...

	if (logfilename !== config.logfile) {
		if (logfilename) {
			console.log(`Closing log ${logfilename}`);
			stream.end();
			logfilename = null;
		}
		console.log(`Logging to ${config.logfile}`);
		logfilename = config.logfile;
		stream = fs.createWriteStream(config.logfile, {flags: "a"});
	}

	if (typeof s !== "string") {
		s = "Warning: log function was sent a non-string";
	}

	stream.write(s + "\n");
};
