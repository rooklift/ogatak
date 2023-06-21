"use strict";

const {ipcRenderer} = require("electron");
const stringify = require("./stringify");

ipcRenderer.on("renderer_globals", (event, o) => {
	for (let [key, value] of Object.entries(o)) {
		global[key] = value;
		console.log(`${key}: ${value}`);
	}
	startup();
});

ipcRenderer.send("renderer_started", null);			// Causes main to send us the renderer_globals message

function startup() {

	const config_io = require("./config_io");		// Creates global.config

	config_io.load();								// Populates global.config
	config_io.create_if_needed();					// Saves config.json if it doesn't exist

	// ---------------------------------------------------------------------------------------------------
	// The order of events is important...

	global.alert = (msg) => {
		ipcRenderer.send("alert", stringify(msg));
	};

	global.hub = require("./hub");
	global.tabber = require("./tabber_v2");
	global.board_drawer = require("./board_drawer");
	global.grapher = require("./grapher");
	global.tree_drawer = require("./tree_drawer");
	global.comment_drawer = require("./comment_drawer");
	global.fullbox = require("./fullbox");
	global.stderrbox = require("./stderrbox");
	global.root_editor = require("./root_editor");

	hub.new_game(19, 19);

	require("./__start_handlers");
	require("./__start_spinners");

	if (config_io.error()) {
		fullbox.warn_bad_config();
	}

	ipcRenderer.send("renderer_ready", null);		// Probably emitted at the same time as ready-to-show
}
