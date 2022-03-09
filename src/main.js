"use strict";

// Remember that prestart.js is run before this.

const electron = require("electron");
const path = require("path");
const url = require("url");
const alert = require("./modules/alert_main");
const colour_choices = require("./modules/colour_choices");
const stringify = require("./modules/stringify");

// --------------------------------------------------------------------------------------------------------------

const config_io = require("./modules/config_io");					// Creates global.config
config_io.load();													// Populates global.config

// --------------------------------------------------------------------------------------------------------------

let menu = menu_build();
let menu_is_set = false;
let queued_files = [];
let win;						// Need to keep global references to every window we make. (Is that still true?)

// --------------------------------------------------------------------------------------------------------------
// Make note of argv strings which could be files to open...

if (path.basename(process.argv[0]).toLowerCase().includes("electron")) {
	if (process.argv.length > 2) {
		queued_files = queued_files.concat(process.argv.slice(2));
	}
} else {
	if (process.argv.length > 1) {
		queued_files = queued_files.concat(process.argv.slice(1));
	}
}

// If we get a second-instance event, add more files to open...

electron.app.on("second-instance", (event, commandLine, workingDirectory, additionalData) => {
	queued_files = queued_files.concat(commandLine.slice(1));
});

// "This event is guaranteed to be emitted after the ready event of app gets emitted."
// So it would likely be ok to create the above handler in our startup() function.

// --------------------------------------------------------------------------------------------------------------

electron.app.whenReady().then(() => {
	startup();
});

// --------------------------------------------------------------------------------------------------------------

function startup() {

	let desired_zoomfactor = 1 / electron.screen.getPrimaryDisplay().scaleFactor;

	win = new electron.BrowserWindow({
		width: Math.round(config.width * desired_zoomfactor),
		height: Math.round(config.height * desired_zoomfactor),
		backgroundColor: "#000000",
		resizable: true,
		show: false,
		useContentSize: true,
		webPreferences: {
			backgroundThrottling: false,
			contextIsolation: false,
			nodeIntegration: true,
			spellcheck: false,
			zoomFactor: desired_zoomfactor			// Unreliable? See https://github.com/electron/electron/issues/10572
		}
	});

	win.once("ready-to-show", () => {
		try {
			win.webContents.setZoomFactor(desired_zoomfactor);	// This seems to work, note issue 10572 above.
		} catch (err) {
			win.webContents.zoomFactor = desired_zoomfactor;	// The method above "will be removed" in future.
		}

		if (config.maxed) {
			win.maximize();
		}

		win.show();
		win.focus();
	});

	win.on("maximize", (event) => {
		two_process_set("maxed", true);
	});

	win.on("unmaximize", (event) => {				// Note that these are not received when a maximized window is minimized.
		two_process_set("maxed", false);			// I think they are only received when a maximized window becomes normal.
	});												// So our .maxed var tracks what we are trying to be, when shown at all.

	// Note: even though there is an event called "restore", if we call win.restore() for a minimized window
	// which wants to go back to being maximized, it generates a "maximize" event, not a "restore" event.

	win.once("close", (event) => {					// Note the once...
		event.preventDefault();						// We prevent the close one time only,
		win.webContents.send("call", "quit");		// to let renderer's "quit" method run once. It then sends "terminate" back.
	});

	electron.ipcMain.on("terminate", () => {
		win.close();
	});

	electron.app.on("window-all-closed", () => {
		electron.app.quit();
	});

	electron.ipcMain.once("renderer_ready", () => {
		queued_files_spinner();
	});

	electron.ipcMain.on("alert", (event, msg) => {
		alert(msg);
	});

	electron.ipcMain.on("set_title", (event, msg) => {
		win.setTitle(msg);
	});

	electron.ipcMain.on("set_checks", (event, msg) => {
		set_checks(msg);
	});

	electron.ipcMain.on("set_check_false", (event, msg) => {
		set_one_check(false, msg);
	});

	electron.ipcMain.on("set_check_true", (event, msg) => {
		set_one_check(true, msg);
	});

	electron.ipcMain.on("fix_colour_checks", (event, msg) => {
		fix_colour_checks(msg);
	});

	electron.ipcMain.on("verify_menupath", (event, msg) => {
		verify_menupath(msg);
	});

	electron.ipcMain.on("save_as_required", (event, msg) => {
		electron.dialog.showSaveDialog(win, {
			defaultPath: config.sgf_folder,
			filters: [{name: "Smart Game Format", extensions: ["sgf"]}, {name: "All files", extensions: ["*"]}]
		})
		.then(o => {
			if (typeof o.filePath === "string" && o.filePath.length > 0) {
				win.webContents.send("call", {
					fn: "save",
					args: [o.filePath]
				});
				two_process_set("sgf_folder", path.dirname(o.filePath));
			}
		});
	});

	electron.Menu.setApplicationMenu(menu);
	menu_is_set = true;

	// Actually load the page last, I guess, so the event handlers above are already set up.
	// Send some possibly useful info as a query.

	let query = {};
	query.user_data_path = electron.app.getPath("userData");
	query.zoomfactor = desired_zoomfactor;

	win.loadFile(
		path.join(__dirname, "ogatak.html"),
		{query: query}
	);
}

// --------------------------------------------------------------------------------------------------------------

function menu_build() {

	return electron.Menu.buildFromTemplate([
		{
			label: "File",
			submenu: [
				{
					label: "About",
					click: () => {
						win.webContents.send("call", {
							fn: "about",
							args: [electron.app.getName(), electron.app.getVersion()]
						});
					}
				},
				{type: "separator"},
				simple_named_caller("New board", "new_game", "CommandOrControl+N"),
				{
					label: "New small board",
					submenu: caller_submenu("new_game_sizestring", ["17 x 17", "15 x 15", "13 x 13", "11 x 11", "9 x 9", "7 x 7"]),
				},
				{
					label: "New rectangular board",
					submenu: rectangular_submenu(),
				},
				{type: "separator"},
				{
					label: "Handicap",
					submenu: caller_submenu("place_handicap", [9, 8, 7, 6, 5, 4, 3, 2]),
				},
				{type: "separator"},
				simple_named_caller("Close tab", "close_tab", "CommandOrControl+W"),
				{type: "separator"},
				{
					label: "Open SGF / GIB / NGF...",
					accelerator: "CommandOrControl+O",
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.sgf_folder, properties: ["multiSelections"]})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("call", {
									fn: "load_multifile",
									args: [o.filePaths]
								});
								two_process_set("sgf_folder", path.dirname(o.filePaths[0]));
							}
						});
					}
				},
				{
					label: "Paste SGF",
					accelerator: "CommandOrControl+Shift+V",
					click: () => {
						win.webContents.send("call", {
							fn: "load_sgf_from_string",
							args: [electron.clipboard.readText()]
						});
					}
				},
				{type: "separator"},
				simple_named_caller("Save game", "save_fast", "CommandOrControl+S"),
				{
					label: "Save game as...",
					click: () => {
						electron.dialog.showSaveDialog(win, {
							defaultPath: config.sgf_folder,
							filters: [{name: "Smart Game Format", extensions: ["sgf"]}, {name: "All files", extensions: ["*"]}]
						})
						.then(o => {
							if (typeof o.filePath === "string" && o.filePath.length > 0) {
								win.webContents.send("call", {
									fn: "save",
									args: [o.filePath]
								});
								two_process_set("sgf_folder", path.dirname(o.filePath));
							}
						});
					},
				},
				{type: "separator"},
				{
					label: "Save collection as...",
					click: () => {
						electron.dialog.showSaveDialog(win, {
							defaultPath: config.sgf_folder,
							filters: [{name: "Smart Game Format", extensions: ["sgf"]}, {name: "All files", extensions: ["*"]}]
						})
						.then(o => {
							if (typeof o.filePath === "string" && o.filePath.length > 0) {
								win.webContents.send("call", {
									fn: "save_collection",
									args: [o.filePath]
								});
								two_process_set("sgf_folder", path.dirname(o.filePath));
							}
						});
					},
				},
				{type: "separator"},
				{
					label: "Quit",
					accelerator: "CommandOrControl+Q",
					role: "quit"
				},
			]
		},
		{
			label: "Setup",
			submenu: [
				{
					label: "Locate KataGo...",
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.katago_folder})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {engine: o.filePaths[0]});
								two_process_set("katago_folder", path.dirname(o.filePaths[0]));
							}
						});
					},
				},
				{
					label: "Locate KataGo analysis config...",
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.kataconfig_folder})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {engineconfig: o.filePaths[0]});
								two_process_set("kataconfig_folder", path.dirname(o.filePaths[0]));
							}
						});
					},
				},
				{
					label: "Choose weights...",
					click: () => {
						electron.dialog.showOpenDialog(win, {defaultPath: config.weights_folder})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {weights: o.filePaths[0]});
								two_process_set("weights_folder", path.dirname(o.filePaths[0]));
							}
						});
					},
				},
				{type: "separator"},
				{
					label: "Launch KataGo via command...",
					click: () => {
						alert(
							"This can be done by editing config.json (which you can find via the Misc menu).\n\n" +

							"Close Ogatak before editing, then edit \"arbitrary_command\" and \"arbitrary_argslist\" " +
							"(which must be given as an array of strings) inside that file.\n\n" +

							"This is for advanced users and won't concern most people."
						);
					}
				},
				{type: "separator"},
				simple_named_caller("Clear cache", "clear_cache"),
				simple_named_caller("Restart", "restart_engine"),
			]
		},
		{
			label: "Tree",
			submenu: [
				simple_named_caller("Play best move", "play_best", ","),
				simple_named_caller("Pass", "pass", "P"),
				{type: "separator"},
				simple_named_caller("Root", "go_to_root", "Home"),				// Likely intercepted by the renderer process, see __start_handlers.js
				simple_named_caller("End", "go_to_end", "End"),					// Likely intercepted by the renderer process, see __start_handlers.js
				{type: "separator"},
				named_caller("Backward", "input_up_down", -1, "Up"),			// Likely intercepted by the renderer process, see __start_handlers.js
				named_caller("Forward", "input_up_down", 1, "Down"),			// Likely intercepted by the renderer process, see __start_handlers.js
				{type: "separator"},
				named_caller("Backward 10", "input_up_down", -10, "PageUp"),	// Likely intercepted by the renderer process, see __start_handlers.js
				named_caller("Forward 10", "input_up_down", 10, "PageDown"),	// Likely intercepted by the renderer process, see __start_handlers.js
				{type: "separator"},
				simple_named_caller("Previous sibling", "prev_sibling", "Left"),
				simple_named_caller("Next sibling", "next_sibling", "Right"),
				{type: "separator"},
				simple_named_caller("Return to main line", "return_to_main", "CommandOrControl+R"),
				{type: "separator"},
				simple_named_caller("Find previous fork", "previous_fork", "CommandOrControl+D"),
				simple_named_caller("Find next fork", "next_fork", "CommandOrControl+F"),
				{type: "separator"},
				named_caller("Promote line", "promote", true, "CommandOrControl+K"),
				named_caller("Promote line to main line", "promote_to_main_line", true, "CommandOrControl+L"),
				{type: "separator"},
				simple_named_caller("Delete node", "delete_node", "CommandOrControl+Backspace"),
				simple_named_caller("Delete all other lines", "delete_other_lines")
			]
		},
		{
			label: "Tools",								// Being made of named checkboxes, this needs special treatment in hub_settings.js
			submenu: [
				named_checkbox("Normal", "mode", "", "1"),
				{type: "separator"},
				named_checkbox("Add Black", "mode", "AB", "2"),
				named_checkbox("Add White", "mode", "AW", "3"),
				named_checkbox("Add Empty", "mode", "AE", "4"),
				{type: "separator"},
				named_checkbox("Triangle", "mode", "TR", "5"),
				named_checkbox("Square", "mode", "TR", "6"),
				named_checkbox("Circle", "mode", "TR", "7"),
				named_checkbox("Cross", "mode", "TR", "8"),
				{type: "separator"},
				simple_named_caller("Toggle active player", "toggle_active_player"),
			],
		},
		{
			label: "Analysis",
			submenu: [
				{
					label: "Go / halt toggle",
					type: "checkbox",
					checked: false,
					accelerator: "Space",				// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "toggle_ponder");
					}
				},
				{type: "separator"},
				simple_named_caller("Go", "go", "CommandOrControl+G"),
				simple_named_caller("Halt", "halt", "CommandOrControl+H"),
				{type: "separator"},
				{
					label: "Self-play",
					type: "checkbox",
					checked: false,
					accelerator: "F11",
					click: () => {
						win.webContents.send("call", "start_autoplay");
					}
				},
				{
					label: "Autoanalysis",
					accelerator: "F12",
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", "start_autoanalysis");
					}
				},
				{type: "separator"},
				{
					label: "Autoanalysis visits",
					submenu: checkbox_submenu("autoanalysis_visits", [10000, 5000, 2500, 1000, 500, 250, 100, 50, 25, 10]),
				},
				{type: "separator"},
				{
					label: "Set rules",
					submenu: caller_submenu("coerce_rules", ["Chinese", "Japanese", "Stone Scoring"]),
				},
				{
					label: "Set komi",
					submenu: caller_submenu("coerce_komi", [7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0]),
				},
				{type: "separator"},
				{
					label: "PV length (max)",
					submenu: checkbox_submenu("analysis_pv_len", [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10]),
				},
				{type: "separator"},
				named_toggle("Wide root noise", "widerootnoise"),
				named_toggle("Symmetry pruning", "symmetry_pruning"),
				{type: "separator"},
				{
					label: "Ownership",
					submenu: [
						checkbox("ownership_marks", "None"),
						checkbox("ownership_marks", "Dead stones", "CommandOrControl+["),
						checkbox("ownership_marks", "Whole board", "CommandOrControl+]"),
					]
				},
				named_toggle("...per-move (costly)", "ownership_per_move"),
				{type: "separator"},
				simple_named_caller("Clear all analysis", "forget_analysis_tree"),
			]
		},
		{
			label: "Display",
			submenu: [
				{
					label: "Visit filter",				// Being made of named checkboxes, this needs special treatment in hub_settings.js
					submenu: [
						named_checkbox("All", "visits_threshold", 0, "A"),
						{type: "separator"},
						named_checkbox("N > 0.5%", "visits_threshold", 0.005, "F1"),
						named_checkbox("N > 1%", "visits_threshold", 0.01),
						named_checkbox("N > 2%", "visits_threshold", 0.02, "F2"),
						named_checkbox("N > 4%", "visits_threshold", 0.04),
						named_checkbox("N > 6%", "visits_threshold", 0.06, "F3"),
						named_checkbox("N > 8%", "visits_threshold", 0.08),
						named_checkbox("N > 10%", "visits_threshold", 0.1, "F4"),
					]
				},
				{
					label: "Numbers",
					submenu: [
						checkbox("numbers", "LCB + Visits", "F5"),
						checkbox("numbers", "Score + Visits", "F6"),
						checkbox("numbers", "Delta + Visits", "F7"),
						{type: "separator"},
						checkbox("numbers", "LCB"),
						checkbox("numbers", "Score"),
						checkbox("numbers", "Delta"),
						checkbox("numbers", "Visits"),
						checkbox("numbers", "Visits (%)"),
						checkbox("numbers", "Order"),
						checkbox("numbers", "Policy"),
						checkbox("numbers", "Winrate"),
						{type: "separator"},
						checkbox("numbers", "LCB + Visits + Score", "F8"),
					]
				},
				{
					label: "Graph",
					submenu: [
						checkbox("graph_type", "Winrate", "F9"),
						checkbox("graph_type", "Score", "F10"),
					]
				},
				{type: "separator"},
				named_toggle("Candidate moves", "candidate_moves", "C"),
				named_toggle("...with PV mouseover", "mouseover_pv", "V"),
				named_toggle("...fade by visits", "visit_colours", "B"),
				{type: "separator"},
				named_toggle("Next move markers", "next_move_markers", "M"),
				{type: "separator"},
				{
					label: "Colours",
					submenu: colour_choices_submenu()
				},
			]
		},
		{
			label: "Sizes",
			submenu: [
				named_toggle("Auto-resize squares", "auto_square_size"),
				{type: "separator"},
				{
					label: "Board squares",
					submenu: checkbox_submenu("square_size", [72, 68, 64, 60, 56, 52, 48, 44, 40, 38, 36, 34, 32, 30]),
				},
				{
					label: "Board font",
					submenu: checkbox_submenu("board_font_size", [32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12]),
				},
				{
					label: "Board lines",
					submenu: checkbox_submenu("board_line_width", [4, 3, 2, 1]),
				},
				{type: "separator"},
				{
					label: "Info font",
					submenu: checkbox_submenu("info_font_size", [32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12]),
				},
				{type: "separator"},
				{
					label: "Graph width",
					submenu: checkbox_submenu("graph_width", [512, 480, 448, 416, 384, 352, 320, 288, 256, 224, 192, 160, 128, 96, 64, 0]),
				},
				{
					label: "Graph major lines",
					submenu: checkbox_submenu("major_graph_linewidth", [4, 3, 2, 1]),
				},
				{
					label: "Graph minor lines",
					submenu: checkbox_submenu("minor_graph_linewidth", [4, 3, 2, 1]),
				},
				{type: "separator"},
				{
					label: "Thumbnail squares",
					submenu: checkbox_submenu("thumbnail_square_size", [8, 6, 4]),
				},
				{type: "separator"},
				{
					label: "Tree spacing",
					submenu: checkbox_submenu("tree_spacing", [48, 44, 40, 36, 32, 28, 24]),
				},
				{
					label: "Comment box",
					submenu: checkbox_submenu("comment_height", [512, 384, 256, 128, 0]),
				},
			]
		},
		{
			label: "Misc",
			submenu: [
				simple_named_caller("Escape", "escape", "Escape"),
				{type: "separator"},
				{role: "toggledevtools"},
				{
					label: `Show ${config_io.filename}`,
					click: () => {
						electron.shell.showItemInFolder(config_io.filepath);
					}
				},
				{type: "separator"},
				{
					label: "Play Black",
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", {
							fn: "start_play_colour",
							args: ["b"]
						});
					}
				},
				{
					label: "Play White",
					type: "checkbox",
					checked: false,
					click: () => {
						win.webContents.send("call", {
							fn: "start_play_colour",
							args: ["w"]
						});
					}
				},
				simple_named_caller("Halt", "halt"),
				{type: "separator"},
				named_toggle("Log engine stderr to console", "stderr_to_console"),
				named_toggle("Load games at final position", "load_at_end"),
				{type: "separator"},
				named_caller("Show root properties", "display_props", true, "CommandOrControl+P"),
				named_caller("Show node properties", "display_props", false, "CommandOrControl+Shift+P"),
				{type: "separator"},
				{
					label: "Engine report rate",
					submenu: checkbox_submenu("report_every", [0.1, 0.2, 0.4]),
				},
			]
		}
	]);
}

// --------------------------------------------------------------------------------------------------------------

function rectangular_submenu() {

	let ret = [];

	for (let x = 19; x >= 2; x--) {
		let subsubmenu = [];
		for (let y = x; y >= 2; y--) {
			subsubmenu.push({
				label: x.toString() + " x " + y.toString(),
				click: () => {
					win.webContents.send("call", {
						fn: "new_game",
						args: [x, y]
					});
				}
			});
		}
		ret.push({
			label: x.toString(),
			submenu: subsubmenu,
		});
	}

	return ret;
}

function colour_choices_submenu() {

	let ret = [];

	for (let item of colour_choices.items) {
		if (item.type === "separator") {
			ret.push({type: "separator"});
		} else {
			ret.push({
				label: item.label,
				type: "checkbox",
				checked: config.top_colour_black === item.opts.top_colour_black &&
				         config.top_colour_white === item.opts.top_colour_white &&
				         config.off_colour_black === item.opts.off_colour_black &&
				         config.off_colour_white === item.opts.off_colour_white,
				click: () => {
					win.webContents.send("call", {
						fn: "apply_colour_settings",
						args: [item.opts]
					});
				}
			});
		}
	}

	return ret;
}

function named_checkbox(label, varname, value, accelerator) {
	let ret = {
		label: label.toString(),
		type: "checkbox",
		checked: config[varname] === value,
		click: () => {
			win.webContents.send("set", {[varname]: value});
		}
	};
	if (accelerator) {
		ret.accelerator = accelerator;
	}
	return ret;
}

function named_caller(label, fn_name, value, accelerator) {		// Assumes 1 single argument to the hub function
	let ret = {
		label: label.toString(),
		click: () => {
			win.webContents.send("call", {
				fn: fn_name,
				args: [value],
			});
		}
	};
	if (accelerator) {
		ret.accelerator = accelerator;
	}
	return ret;
}

function simple_named_caller(label, fn_name, accelerator) {		// 0 arguments to the hub function
	let ret = {
		label: label.toString(),
		click: () => {
			win.webContents.send("call", fn_name);
		}
	};
	if (accelerator) {
		ret.accelerator = accelerator;
	}
	return ret;
}

function named_toggle(label, varname, accelerator) {
	let ret = {
		label: label.toString(),
		type: "checkbox",
		checked: !!config[varname],
		click: () => {
			win.webContents.send("toggle", varname);
		}
	};
	if (accelerator) {
		ret.accelerator = accelerator;
	}
	return ret;
}

function checkbox(varname, value, accelerator) {
	return named_checkbox(value, varname, value, accelerator);
}

function caller(fn_name, value, accelerator) {
	return named_caller(value, fn_name, value, accelerator);
}

function checkbox_submenu(varname, values) {
	return values.map(val => checkbox(varname, val));
}

function caller_submenu(fn_name, values) {
	return values.map(val => caller(fn_name, val));
}

// --------------------------------------------------------------------------------------------------------------

function get_submenu_items(menupath) {

	// Not case-sensitive (or even type sensitive) in the menupath array, above.
	//
	// If the path is to a submenu, this returns a list of all items in the submenu.
	// If the path is to a specific menu item, it just returns that item.

	let ret = menu.items;

	for (let s of menupath) {

		s = stringify(s).toLowerCase();

		ret = ret.find(o => o.label.toLowerCase() === s);

		if (ret === undefined) {
			throw new Error(`get_submenu_items(): invalid path: ${menupath}`);
		}

		if (ret.submenu) {
			ret = ret.submenu.items;
		}
	}

	return ret;
}

function set_checks(menupath) {

	if (!menu_is_set) {
		return;
	}

	// Since I don't know precisely how the menu works behind the scenes, give a little time for the original
	// click to go through first. This is probably some irrational magical thinking.

	setTimeout(() => {
		let items = get_submenu_items(menupath.slice(0, -1));
		let desired = stringify(menupath[menupath.length - 1]).toLowerCase();
		for (let n = 0; n < items.length; n++) {
			if (items[n].checked !== undefined) {
				items[n].checked = items[n].label.toLowerCase() === desired;
			}
		}
	}, 50);
}

function set_one_check(desired_state, menupath) {

	if (!menu_is_set) {
		return;
	}

	let item = get_submenu_items(menupath);

	if (item.checked !== undefined) {
		item.checked = desired_state ? true : false;
	}
}

function verify_menupath(menupath) {

	if (!menu_is_set) {						// Not possible given how this is used, I think.
		return;
	}

	try {
		get_submenu_items(menupath);
	} catch (err) {
		alert(`Failed to verify menupath: ${stringify(menupath)}`);
	}
}

function fix_colour_checks(msg) {
	for (let item of colour_choices.items) {
		if (!item.opts) {
			continue;
		}
		let ok = true;
		for (let key of Object.keys(item.opts)) {
			if (item.opts[key] !== msg[key]) {
				ok = false;
				break;
			}
		}
		if (ok) {
			set_checks(["Display", "Colours", item.label]);
			return;
		}
	}
	set_checks(["Display", "Colours", "?"]);
}

// --------------------------------------------------------------------------------------------------------------

function two_process_set(key, value) {

	// For most keys we don't care that the main and renderer processes get their configs out
	// of sync as the user changes things, but this function can be used when it does matter.
	// Remember it's the renderer process that actually saves our config file.

	config[key] = value;

	let msg = {};
	msg[key] = value;					// not msg = {key: value} which makes the key "key"
	win.webContents.send("set", msg);
}

// --------------------------------------------------------------------------------------------------------------

function queued_files_spinner() {

	// The reason we do this is so that, when the user opens a bunch of files at once, they are batched up
	// into a group instead of being sent one by one, which would cause a bunch of redraws. In practice,
	// the startup process of all the second-instance apps seems to be slow enough this isn't too helpful.

	if (queued_files.length > 0) {

		// We need to focus asap before the file actually loads, because the load might generate
		// an error alert, which must happen after the focus() so the alert is on top.

		if (win.isMinimized()) {
			win.restore();			// Works regardless of whether the window was previously normal or maximized.
		}
		// win.show();				// Not sure this does anything, might even be causing bugs, see Electron #26277
		win.focus();

		win.webContents.send("call", {
			fn: "load_multifile",
			args: [queued_files]
		});

		queued_files = [];

	}

	setTimeout(queued_files_spinner, 125);
}
