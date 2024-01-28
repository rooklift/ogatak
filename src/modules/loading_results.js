"use strict";

function new_load_results() {
	let ret = Object.create(load_results_prototype);
	ret.roots = [];
	ret.errors = [];
	ret.size_rejections = 0;
	return ret;
}

let load_results_prototype = {

	add_roots: function(...args) {
		let arr = args.flat(Infinity);
		for (let root of arr) {
			if (root.width() > 19 || root.height() > 19) {
				this.size_rejections++;
			} else {
				this.roots.push(root);
			}
		}
	},

	add_errors: function(...args) {				// args are expected to be actual errors, or strings.
		let arr = args.flat(Infinity);
		for (let error of arr) {
			if (typeof error === "string") {
				error = new Error(error);
			}
			this.errors.push(error);
		}
	},

	absorb: function(...args) {					// args are expected to be other load_results objects.
		let arr = args.flat(Infinity);
		for (let o of arr) {
			this.roots = this.roots.concat(o.roots);
			this.errors = this.errors.concat(o.errors);
			this.size_rejections += o.size_rejections;
		}
	},

	display_issues: function() {				// Won't do anything if no errors or rejections.
		let size_msg = "";
		if (this.size_rejections > 0) {
			let noun = this.size_rejections === 1 ? "game" : "games";
			size_msg = `Rejected ${this.size_rejections} ${noun}, because sizes > 19 are not supported.`;
		}
		if (this.errors.length > 1) {
			if (size_msg) {
				alert(`${size_msg} Also, ${this.errors.length} other games were rejected due to errors.`);
			} else {
				alert(`${this.errors.length} games were rejected due to errors.`);
			}
		} else if (this.errors.length === 1) {
			let error_msg = this.errors[0].toString();
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
