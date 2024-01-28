"use strict";

// The load_results object is useful for loading multiple files, as well
// as SGF files with multiple games, since it can store both roots and
// errors. It also disallows sizes > 19 and keeps track of how many
// games were rejected as such...

function new_load_results() {
	let ret = Object.create(load_results_prototype);
	ret._roots = [];
	ret._errors = [];
	ret._size_rejections = 0;
	return ret;
}

let load_results_prototype = {

	count_roots: function() {
		return this._roots.length;
	},

	count_errors: function() {
		return this._errors.length;
	},

	count_size_rejections: function() {
		return this._size_rejections;
	},

	get_roots: function() {
		return Array.from(this._roots);
	},

	add_roots: function(...args) {
		let arr = args.flat(Infinity);
		for (let root of arr) {
			if (root.width() > 19 || root.height() > 19) {
				this._size_rejections++;
			} else {
				this._roots.push(root);
			}
		}
	},

	add_errors: function(...args) {				// args are expected to be actual errors, or strings.
		let arr = args.flat(Infinity);
		for (let error of arr) {
			if (typeof error === "string") {
				error = new Error(error);
			}
			this._errors.push(error);
		}
	},

	absorb: function(...args) {					// args are expected to be other load_results objects.
		let arr = args.flat(Infinity);
		for (let o of arr) {
			this._roots = this._roots.concat(o._roots);
			this._errors = this._errors.concat(o._errors);
			this._size_rejections += o._size_rejections;
		}
	},

	display_issues: function() {				// Won't do anything if no errors or rejections.
		let size_msg = "";
		if (this._size_rejections > 0) {
			let noun = this._size_rejections === 1 ? "game" : "games";
			size_msg = `Rejected ${this._size_rejections} ${noun}, because sizes > 19 are not supported.`;
		}
		if (this._errors.length > 1) {
			if (size_msg) {
				alert(`${size_msg} Also, ${this._errors.length} other games were rejected due to errors.`);
			} else {
				alert(`${this._errors.length} games were rejected due to errors.`);
			}
		} else if (this._errors.length === 1) {
			let error_msg = this._errors[0].toString();
			if (error_msg.startsWith("Error: ")) {
				error_msg = error_msg.slice(7);
			}
			if (size_msg) {
				alert(`${size_msg} Also, 1 other game was rejected because: ${error_msg}`);
			} else {
				alert(`Rejected 1 game because: ${error_msg}`);
			}
		} else if (size_msg) {
			alert(size_msg);
		}
	},

};


module.exports = new_load_results;
