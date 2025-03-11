"use strict";

let toast_count = 0;

function toast(message, duration = 2000) {

	let new_toast_count = ++toast_count;

	let t = document.getElementById("toast");

	t.textContent = message;
	t.classList.add("visible");

	setTimeout(() => {
		if (new_toast_count === toast_count) {
			t.classList.remove("visible");
		}
	}, duration);
}

module.exports = toast;
