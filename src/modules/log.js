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
			stream = null;
			logfilename = null;
		}
		return;
	}

	// So at this point, we know config.logfile is some string...

	if (logfilename !== config.logfile) {
		if (logfilename) {
			console.log(`Closing log ${logfilename}`);
			stream.end();
			stream = null;
			logfilename = null;
		}
		console.log(`Logging to ${config.logfile}`);
		let new_stream = fs.createWriteStream(config.logfile, {flags: "a"});
		new_stream.on("error", (err) => {
			console.log(err);
			new_stream.end();
			if (stream === new_stream) {		// Presumably true, but avoiding some race condition.
				stream = null;
				logfilename = null;
				hub.set("logfile", null);
			}
		});
		stream = new_stream;
		logfilename = config.logfile;
	}

	if (typeof s !== "string") {
		s = "Warning: log function was sent a non-string";
	}

	stream.write(s + "\n");
};
