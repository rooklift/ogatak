"use strict";

const {replace_all} = require("./utils");

module.exports = {

	div: document.getElementById("comments"),

	draw: function(node) {

		let s = node.get("C");

		if (config.comment_height <= 0) {
			s = "";
		}

		s = replace_all(s,  `&`  ,  `&amp;`   );		// This needs to be first of course.
		s = replace_all(s,  `<`  ,  `&lt;`    );
		s = replace_all(s,  `>`  ,  `&gt;`    );
		s = replace_all(s,  `'`  ,  `&apos;`  );
		s = replace_all(s,  `"`  ,  `&quot;`  );

		this.div.innerHTML = s;
	},

	fix_font: function() {
		this.div.style["font-size"] = config.info_font_size.toString() + "px";
	}
};

