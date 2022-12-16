"use strict";

const fs = require("fs");

let logger = null;

// To avoid various race conditions and whatnot, it's best to create a new logger
// object each time the destination filename changes...

function new_logger(filepath) {
	let ret = Object.create(logger_prototype);
	ret.init(filepath);
	return ret;
}

let logger_prototype = {

	init: function(filepath) {

		console.log(`Logging to ${filepath}`);

		this.filepath = filepath;
		this.stream = fs.createWriteStream(filepath, {flags: "a"});			// If this fails it does not throw, rather it generates an error soonish...

		this.stream.on("error", (err) => {
			console.log(err);
			this.close();
		});
	},

	close: function() {
		if (this.stream) {
			console.log(`Closing ${this.filepath}`);
			this.stream.end();
			this.stream = null;
			// this.filepath = null;				// Leave this alone, so that even when closed we can still absorb logs for this (broken) filepath.
		}
	},

	log: function(s) {
		if (this.stream) {
			this.stream.write(s + "\n");
		}
	},

};



module.exports = function(s) {

	if (logger) {
		if (config.logfile !== logger.filepath) {
			logger.close();
			logger = null;
		}
	}

	if (!logger) {
		if (typeof config.logfile === "string" && config.logfile !== "") {
			logger = new_logger(config.logfile);
		}
	}

	if (logger) {
		logger.log(s);
	}

};
