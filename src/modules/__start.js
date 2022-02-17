"use strict";

const {ipcRenderer} = require("electron");
const querystring = require("querystring");

const config_io = require("./config_io");
const stringify = require("./stringify");

config_io.load();					// Creates global.config
config_io.create_if_needed();

// ---------------------------------------------------------------------------------------------------
// The order of events is important...

global.alert = (msg) => {
	ipcRenderer.send("alert", stringify(msg));
};

global.zoomfactor = parseFloat(querystring.parse(global.location.search).zoomfactor);
global.testing = require("./testing");
global.hub = require("./hub").new_hub();

require("./__start_handlers");

hub.new_game(19, 19);
hub.tabber.draw_tabs(hub.node);

hub.window_resize_checker();
hub.active_tab_draw_spinner();
hub.graph_draw_spinner();
hub.tree_draw_spinner();
hub.up_down_spinner();
hub.bad_death_mark_spinner();

if (config_io.error()) {
	alert(`${config_io.filename} failed to load. It will not be saved to until you fix this. Error:\n` + config_io.error());
}

ipcRenderer.send("renderer_ready", null);
