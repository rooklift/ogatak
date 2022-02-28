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
let renderer_ready = false;
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
	if (renderer_ready) {
		win.webContents.send("call", {
			fn: "load_multifile",
			args: [commandLine.slice(1)]
		});
		setTimeout(() => {							// Give it a chance to actually load before it shows.
			win.show();
			win.focus();
		}, 125);
	} else {
		queued_files = queued_files.concat(commandLine.slice(1));
	}
});

electron.app.whenReady().then(() => {
	startup();
});

// --------------------------------------------------------------------------------------------------------------

function startup() {

	let desired_zoomfactor = 1 / electron.screen.getPrimaryDisplay().scaleFactor;

	win = new electron.BrowserWindow({
		width: config.width,
		height: config.height,
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

	win.once("close", (event) => {					// Note the once...
		event.preventDefault();						// We prevent the close one time only,
		win.webContents.send("call", "quit");		// to let renderer's "quit" method run once. It then sends "terminate" back.
	});

	win.on("maximize", (event) => {
		win.webContents.send("set", {"maxed": true});
	});

	win.on("unmaximize", (event) => {
		win.webContents.send("set", {"maxed": false});
	});

	electron.ipcMain.on("terminate", () => {
		win.close();
	});

	electron.app.on("window-all-closed", () => {
		electron.app.quit();
	});

	electron.ipcMain.once("renderer_ready", () => {

		renderer_ready = true;

		// Open files via command line. We must wait until the renderer has properly loaded before we do this.
		// While it might seem like we could do this after "ready-to-show" I'm not 100% sure that the renderer
		// will have fully loaded when that fires.

		if (queued_files.length > 0) {
			win.webContents.send("call", {
				fn: "load_multifile",
				args: [queued_files]
			});
		}
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

	let colour_choices_submenu = [];

	const template = [
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
				{
					type: "separator",
				},
				{
					label: "New game",
					accelerator: "CommandOrControl+N",
					click: () => {
						win.webContents.send("call", {
							fn: "new_game",
							args: [19, 19]
						});
					}
				},
				{
					label: "New small board",
					submenu: [
						{
							label: "17x17",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [17, 17]
								});
							}
						},
						{
							label: "15x15",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [15, 15]
								});
							}
						},
						{
							label: "13x13",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [13, 13]
								});
							}
						},
						{
							label: "11x11",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [11, 11]
								});
							}
						},
						{
							label: "9x9",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [9, 9]
								});
							}
						},
						{
							label: "7x7",
							click: () => {
								win.webContents.send("call", {
									fn: "new_game",
									args: [7, 7]
								});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: "Handicap",
					submenu: [
						{
							label: "9",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [9]
								});
							}
						},
						{
							label: "8",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [8]
								});
							}
						},
						{
							label: "7",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [7]
								});
							}
						},
						{
							label: "6",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [6]
								});
							}
						},
						{
							label: "5",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [5]
								});
							}
						},
						{
							label: "4",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [4]
								});
							}
						},
						{
							label: "3",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [3]
								});
							}
						},
						{
							label: "2",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
									args: [2]
								});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: "Close tab",
					accelerator: "CommandOrControl+W",
					click: () => {
						win.webContents.send("call", "close_tab");
					}
				},
				{
					type: "separator",
				},
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
				{
					type: "separator",
				},
				{
					label: "Save game",
					accelerator: "CommandOrControl+S",
					click: () => {
						win.webContents.send("call", "save_fast");
					}
				},
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
				{
					type: "separator",
				},
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
				{
					type: "separator",
				},
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
				{
					type: "separator",
				},
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
				{
					type: "separator",
				},
				{
					label: "Clear cache",
					click: () => {
						win.webContents.send("call", "clear_cache");
					}
				},
				{
					label: "Restart",
					click: () => {
						win.webContents.send("call", "restart_engine");
					}
				},
			]
		},
		{
			label: "Tree",
			submenu: [
				{
					label: "Play best move",
					accelerator: ",",
					click: () => {
						win.webContents.send("call", "play_best");
					}
				},
				{
					label: "Pass",
					accelerator: "P",
					click: () => {
						win.webContents.send("call", "pass");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Root",
					accelerator: "Home",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "go_to_root");
					}
				},
				{
					label: "End",
					accelerator: "End",			// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "go_to_end");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Backward",
					accelerator: "Up",			// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [-1]
						});
					}
				},
				{
					label: "Forward",
					accelerator: "Down",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [1]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: "Backward 10",
					accelerator: "PageUp",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [-10]
						});
					}
				},
				{
					label: "Forward 10",
					accelerator: "PageDown",	// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", {
							fn: "input_up_down",
							args: [10]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: "Previous sibling",
					accelerator: "Left",
					click: () => {
						win.webContents.send("call", "prev_sibling");
					}
				},
				{
					label: "Next sibling",
					accelerator: "Right",
					click: () => {
						win.webContents.send("call", "next_sibling");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Return to main line",
					accelerator: "CommandOrControl+R",
					click: () => {
						win.webContents.send("call", "return_to_main");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Find previous fork",
					accelerator: "CommandOrControl+D",
					click: () => {
						win.webContents.send("call", "previous_fork");
					}
				},
				{
					label: "Find next fork",
					accelerator: "CommandOrControl+F",
					click: () => {
						win.webContents.send("call", "next_fork");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Promote line",
					accelerator: "CommandOrControl+K",
					click: () => {
						win.webContents.send("call", {
							fn: "promote",
							args: [true]
						});
					}
				},
				{
					label: "Promote line to main line",
					accelerator: "CommandOrControl+L",
					click: () => {
						win.webContents.send("call", {
							fn: "promote_to_main_line",
							args: [true]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: "Delete node",
					accelerator: "CommandOrControl+Backspace",
					click: () => {
						win.webContents.send("call", "delete_node");
					}
				},
				{
					label: "Delete all other lines",
					click: () => {
						win.webContents.send("call", "delete_other_lines");
					}
				},
			]
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
				{
					type: "separator",
				},
				{
					label: "Go",
					accelerator: "CommandOrControl+G",
					click: () => {
						win.webContents.send("call", "go");
					}
				},
				{
					label: "Halt",
					accelerator: "CommandOrControl+H",
					click: () => {
						win.webContents.send("call", "halt");
					}
				},
				{
					type: "separator",
				},
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
				{
					type: "separator",
				},
				{
					label: "Autoanalysis visits",
					submenu: [
						{
							label: "10000",
							type: "checkbox",
							checked: config.autoanalysis_visits === 10000,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 10000});
							}
						},
						{
							label: "5000",
							type: "checkbox",
							checked: config.autoanalysis_visits === 5000,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 5000});
							}
						},
						{
							label: "2500",
							type: "checkbox",
							checked: config.autoanalysis_visits === 2500,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 2500});
							}
						},
						{
							label: "1000",
							type: "checkbox",
							checked: config.autoanalysis_visits === 1000,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 1000});
							}
						},
						{
							label: "500",
							type: "checkbox",
							checked: config.autoanalysis_visits === 500,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 500});
							}
						},
						{
							label: "250",
							type: "checkbox",
							checked: config.autoanalysis_visits === 250,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 250});
							}
						},
						{
							label: "100",
							type: "checkbox",
							checked: config.autoanalysis_visits === 100,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 100});
							}
						},
						{
							label: "50",
							type: "checkbox",
							checked: config.autoanalysis_visits === 50,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 50});
							}
						},
						{
							label: "25",
							type: "checkbox",
							checked: config.autoanalysis_visits === 25,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 25});
							}
						},
						{
							label: "10",
							type: "checkbox",
							checked: config.autoanalysis_visits === 10,
							click: () => {
								win.webContents.send("set", {autoanalysis_visits: 10});
							}
						}
					]
				},
				{
					type: "separator",
				},
				{
					label: "Set rules",
					submenu: [
						{
							label: "Chinese",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_rules",
									args: ["Chinese"]
								});
							}
						},
						{
							label: "Japanese",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_rules",
									args: ["Japanese"]
								});
							}
						},
						{
							label: "Stone Scoring",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_rules",
									args: ["Stone Scoring"]
								});
							}
						},
					]
				},
				{
					label: "Set komi",
					submenu: [
						{
							label: "7.5",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [7.5]
								});
							}
						},
						{
							label: "7",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [7]
								});
							}
						},
						{
							label: "6.5",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [6.5]
								});
							}
						},
						{
							label: "6",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [6]
								});
							}
						},
						{
							label: "5.5",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [5.5]
								});
							}
						},
						{
							label: "5",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [5]
								});
							}
						},
						{
							label: "4.5",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [4.5]
								});
							}
						},
						{
							type: "separator",
						},
						{
							label: "0.5",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [0.5]
								});
							}
						},
						{
							label: "0",
							click: () => {
								win.webContents.send("call", {
									fn: "coerce_komi",
									args: [0]
								});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: "PV length (max)",
					submenu: [
						{
							label: "30",
							type: "checkbox",
							checked: config.analysis_pv_len === 30,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 30});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.analysis_pv_len === 28,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 28});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.analysis_pv_len === 26,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 26});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.analysis_pv_len === 24,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 24});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.analysis_pv_len === 22,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 22});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.analysis_pv_len === 20,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 20});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.analysis_pv_len === 18,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 18});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.analysis_pv_len === 16,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 16});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.analysis_pv_len === 14,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 14});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.analysis_pv_len === 12,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 12});
							}
						},
						{
							label: "10",
							type: "checkbox",
							checked: config.analysis_pv_len === 10,
							click: () => {
								win.webContents.send("set", {analysis_pv_len: 10});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: "Wide root noise",
					type: "checkbox",
					checked: config.widerootnoise,
					click: () => {
						win.webContents.send("toggle", "widerootnoise");
					}
				},
				{
					label: "Symmetry pruning",
					type: "checkbox",
					checked: config.symmetry_pruning,
					click: () => {
						win.webContents.send("toggle", "symmetry_pruning");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Dead stone prediction",
					type: "checkbox",
					checked: config.dead_stone_prediction,
					click: () => {
						win.webContents.send("toggle", "dead_stone_prediction");
					}
				},
				{
					label: "...per move",
					type: "checkbox",
					checked: config.dead_stone_per_move,
					click: () => {
						win.webContents.send("toggle", "dead_stone_per_move");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Clear all analysis",
					click: () => {
						win.webContents.send("call", "forget_analysis_tree");
					}
				},
			]
		},
		{
			label: "Display",
			submenu: [
				{
					label: "Visit filter",
					submenu: [
						{
							label: "All",
							type: "checkbox",
							checked: config.visits_threshold === 0,
							accelerator: "A",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0});
							}
						},
						{
							type: "separator"
						},
						{
							label: "N > 0.5%",
							type: "checkbox",
							checked: config.visits_threshold === 0.005,
							accelerator: "F1",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.005});
							}
						},
						{
							label: "N > 1%",
							type: "checkbox",
							checked: config.visits_threshold === 0.01,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.01});
							}
						},
						{
							label: "N > 2%",
							type: "checkbox",
							checked: config.visits_threshold === 0.02,
							accelerator: "F2",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.02});
							}
						},
						{
							label: "N > 4%",
							type: "checkbox",
							checked: config.visits_threshold === 0.04,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.04});
							}
						},
						{
							label: "N > 6%",
							type: "checkbox",
							checked: config.visits_threshold === 0.06,
							accelerator: "F3",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.06});
							}
						},
						{
							label: "N > 8%",
							type: "checkbox",
							checked: config.visits_threshold === 0.08,
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.08});
							}
						},
						{
							label: "N > 10%",
							type: "checkbox",
							checked: config.visits_threshold === 0.1,
							accelerator: "F4",
							click: () => {
								win.webContents.send("set", {visits_threshold: 0.1});
							}
						},
					]
				},
				{
					label: "Numbers",
					submenu: [
						{
							label: "LCB + Visits",
							type: "checkbox",
							checked: config.numbers === "LCB + Visits",
							accelerator: "F5",
							click: () => {
								win.webContents.send("set", {numbers: "LCB + Visits"});
							}
						},
						{
							label: "Score + Visits",
							type: "checkbox",
							checked: config.numbers === "Score + Visits",
							accelerator: "F6",
							click: () => {
								win.webContents.send("set", {numbers: "Score + Visits"});
							}
						},
						{
							label: "Delta + Visits",
							type: "checkbox",
							checked: config.numbers === "Delta + Visits",
							accelerator: "F7",
							click: () => {
								win.webContents.send("set", {numbers: "Delta + Visits"});
							}
						},
						{
							type: "separator",
						},
						{
							label: "LCB + Visits + Score",
							type: "checkbox",
							checked: config.numbers === "LCB + Visits + Score",
							accelerator: "F8",
							click: () => {
								win.webContents.send("set", {numbers: "LCB + Visits + Score"});
							}
						},
						{
							type: "separator",
						},
						{
							label: "LCB",
							type: "checkbox",
							checked: config.numbers === "LCB",
							click: () => {
								win.webContents.send("set", {numbers: "LCB"});
							}
						},
						{
							label: "Score",
							type: "checkbox",
							checked: config.numbers === "Score",
							click: () => {
								win.webContents.send("set", {numbers: "Score"});
							}
						},
						{
							label: "Delta",
							type: "checkbox",
							checked: config.numbers === "Delta",
							click: () => {
								win.webContents.send("set", {numbers: "Delta"});
							}
						},
						{
							label: "Visits",
							type: "checkbox",
							checked: config.numbers === "Visits",
							click: () => {
								win.webContents.send("set", {numbers: "Visits"});
							}
						},
						{
							label: "Visits (%)",
							type: "checkbox",
							checked: config.numbers === "Visits (%)",
							click: () => {
								win.webContents.send("set", {numbers: "Visits (%)"});
							}
						},
						{
							label: "Order",
							type: "checkbox",
							checked: config.numbers === "Order",
							click: () => {
								win.webContents.send("set", {numbers: "Order"});
							}
						},
						{
							label: "Policy",
							type: "checkbox",
							checked: config.numbers === "Policy",
							click: () => {
								win.webContents.send("set", {numbers: "Policy"});
							}
						},
						{
							label: "Winrate",
							type: "checkbox",
							checked: config.numbers === "Winrate",
							click: () => {
								win.webContents.send("set", {numbers: "Winrate"});
							}
						},
					]
				},
				{
					label: "Graph",
					submenu: [
						{
							label: "Winrate",
							type: "checkbox",
							checked: config.graph_type === "Winrate",
							accelerator: "F9",
							click: () => {
								win.webContents.send("set", {graph_type: "Winrate"});
							}
						},
						{
							label: "Score",
							type: "checkbox",
							checked: config.graph_type === "Score",
							accelerator: "F10",
							click: () => {
								win.webContents.send("set", {graph_type: "Score"});
							}
						},
					]
				},
				{
					type: "separator",
				},
				{
					label: "Candidate moves",
					type: "checkbox",
					checked: config.candidate_moves,
					accelerator: "C",
					click: () => {
						win.webContents.send("toggle", "candidate_moves");
					}
				},
				{
					label: "...with PV mouseover",
					type: "checkbox",
					checked: config.mouseover_pv,
					accelerator: "V",
					click: () => {
						win.webContents.send("toggle", "mouseover_pv");
					}
				},
				{
					label: "...colour by visits",
					type: "checkbox",
					checked: config.visit_colours,
					accelerator: "B",
					click: () => {
						win.webContents.send("toggle", "visit_colours");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Next move markers",
					type: "checkbox",
					checked: config.next_move_markers,
					accelerator: "M",
					click: () => {
						win.webContents.send("toggle", "next_move_markers");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Colours",
					submenu: colour_choices_submenu
				},
			]
		},
		{
			label: "Sizes",
			submenu: [
				{
					label: "Auto-resize squares",
					type: "checkbox",
					checked: config.auto_square_size,
					click: () => {
						win.webContents.send("toggle", "auto_square_size");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Board squares",
					submenu: [
						{
							label: "72",
							type: "checkbox",
							checked: config.square_size === 72,
							click: () => {
								win.webContents.send("set", {square_size: 72});
							}
						},
						{
							label: "68",
							type: "checkbox",
							checked: config.square_size === 68,
							click: () => {
								win.webContents.send("set", {square_size: 68});
							}
						},
						{
							label: "64",
							type: "checkbox",
							checked: config.square_size === 64,
							click: () => {
								win.webContents.send("set", {square_size: 64});
							}
						},
						{
							label: "60",
							type: "checkbox",
							checked: config.square_size === 60,
							click: () => {
								win.webContents.send("set", {square_size: 60});
							}
						},
						{
							label: "56",
							type: "checkbox",
							checked: config.square_size === 56,
							click: () => {
								win.webContents.send("set", {square_size: 56});
							}
						},
						{
							label: "52",
							type: "checkbox",
							checked: config.square_size === 52,
							click: () => {
								win.webContents.send("set", {square_size: 52});
							}
						},
						{
							label: "48",
							type: "checkbox",
							checked: config.square_size === 48,
							click: () => {
								win.webContents.send("set", {square_size: 48});
							}
						},
						{
							label: "44",
							type: "checkbox",
							checked: config.square_size === 44,
							click: () => {
								win.webContents.send("set", {square_size: 44});
							}
						},
						{
							label: "40",
							type: "checkbox",
							checked: config.square_size === 40,
							click: () => {
								win.webContents.send("set", {square_size: 40});
							}
						},
						{
							label: "38",
							type: "checkbox",
							checked: config.square_size === 38,
							click: () => {
								win.webContents.send("set", {square_size: 38});
							}
						},
						{
							label: "36",
							type: "checkbox",
							checked: config.square_size === 36,
							click: () => {
								win.webContents.send("set", {square_size: 36});
							}
						},
						{
							label: "34",
							type: "checkbox",
							checked: config.square_size === 34,
							click: () => {
								win.webContents.send("set", {square_size: 34});
							}
						},
						{
							label: "32",
							type: "checkbox",
							checked: config.square_size === 32,
							click: () => {
								win.webContents.send("set", {square_size: 32});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.square_size === 30,
							click: () => {
								win.webContents.send("set", {square_size: 30});
							}
						},
					]
				},
				{
					label: "Board font",
					submenu: [
						{
							label: "32",
							type: "checkbox",
							checked: config.board_font_size === 32,
							click: () => {
								win.webContents.send("set", {board_font_size: 32});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.board_font_size === 30,
							click: () => {
								win.webContents.send("set", {board_font_size: 30});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.board_font_size === 28,
							click: () => {
								win.webContents.send("set", {board_font_size: 28});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.board_font_size === 26,
							click: () => {
								win.webContents.send("set", {board_font_size: 26});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.board_font_size === 24,
							click: () => {
								win.webContents.send("set", {board_font_size: 24});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.board_font_size === 22,
							click: () => {
								win.webContents.send("set", {board_font_size: 22});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.board_font_size === 20,
							click: () => {
								win.webContents.send("set", {board_font_size: 20});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.board_font_size === 18,
							click: () => {
								win.webContents.send("set", {board_font_size: 18});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.board_font_size === 16,
							click: () => {
								win.webContents.send("set", {board_font_size: 16});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.board_font_size === 14,
							click: () => {
								win.webContents.send("set", {board_font_size: 14});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.board_font_size === 12,
							click: () => {
								win.webContents.send("set", {board_font_size: 12});
							}
						},
					]
				},
				{
					label: "Board lines",
					submenu: [
						{
							label: "4",
							type: "checkbox",
							checked: config.board_line_width === 4,
							click: () => {
								win.webContents.send("set", {board_line_width: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.board_line_width === 3,
							click: () => {
								win.webContents.send("set", {board_line_width: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.board_line_width === 2,
							click: () => {
								win.webContents.send("set", {board_line_width: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.board_line_width === 1,
							click: () => {
								win.webContents.send("set", {board_line_width: 1});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: "Info font",
					submenu: [
						{
							label: "32",
							type: "checkbox",
							checked: config.info_font_size === 32,
							click: () => {
								win.webContents.send("set", {info_font_size: 32});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.info_font_size === 30,
							click: () => {
								win.webContents.send("set", {info_font_size: 30});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.info_font_size === 28,
							click: () => {
								win.webContents.send("set", {info_font_size: 28});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.info_font_size === 26,
							click: () => {
								win.webContents.send("set", {info_font_size: 26});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.info_font_size === 24,
							click: () => {
								win.webContents.send("set", {info_font_size: 24});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.info_font_size === 22,
							click: () => {
								win.webContents.send("set", {info_font_size: 22});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.info_font_size === 20,
							click: () => {
								win.webContents.send("set", {info_font_size: 20});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.info_font_size === 18,
							click: () => {
								win.webContents.send("set", {info_font_size: 18});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.info_font_size === 16,
							click: () => {
								win.webContents.send("set", {info_font_size: 16});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.info_font_size === 14,
							click: () => {
								win.webContents.send("set", {info_font_size: 14});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.info_font_size === 12,
							click: () => {
								win.webContents.send("set", {info_font_size: 12});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: "Graph width",
					submenu: [
						{
							label: "512",
							type: "checkbox",
							checked: config.graph_width === 512,
							click: () => {
								win.webContents.send("set", {graph_width: 512});
							}
						},
						{
							label: "480",
							type: "checkbox",
							checked: config.graph_width === 480,
							click: () => {
								win.webContents.send("set", {graph_width: 480});
							}
						},
						{
							label: "448",
							type: "checkbox",
							checked: config.graph_width === 448,
							click: () => {
								win.webContents.send("set", {graph_width: 448});
							}
						},
						{
							label: "416",
							type: "checkbox",
							checked: config.graph_width === 416,
							click: () => {
								win.webContents.send("set", {graph_width: 416});
							}
						},
						{
							label: "384",
							type: "checkbox",
							checked: config.graph_width === 384,
							click: () => {
								win.webContents.send("set", {graph_width: 384});
							}
						},
						{
							label: "352",
							type: "checkbox",
							checked: config.graph_width === 352,
							click: () => {
								win.webContents.send("set", {graph_width: 352});
							}
						},
						{
							label: "320",
							type: "checkbox",
							checked: config.graph_width === 320,
							click: () => {
								win.webContents.send("set", {graph_width: 320});
							}
						},
						{
							label: "288",
							type: "checkbox",
							checked: config.graph_width === 288,
							click: () => {
								win.webContents.send("set", {graph_width: 288});
							}
						},
						{
							label: "256",
							type: "checkbox",
							checked: config.graph_width === 256,
							click: () => {
								win.webContents.send("set", {graph_width: 256});
							}
						},
						{
							label: "224",
							type: "checkbox",
							checked: config.graph_width === 224,
							click: () => {
								win.webContents.send("set", {graph_width: 224});
							}
						},
						{
							label: "192",
							type: "checkbox",
							checked: config.graph_width === 192,
							click: () => {
								win.webContents.send("set", {graph_width: 192});
							}
						},
						{
							label: "160",
							type: "checkbox",
							checked: config.graph_width === 160,
							click: () => {
								win.webContents.send("set", {graph_width: 160});
							}
						},
						{
							label: "128",
							type: "checkbox",
							checked: config.graph_width === 128,
							click: () => {
								win.webContents.send("set", {graph_width: 128});
							}
						},
						{
							label: "96",
							type: "checkbox",
							checked: config.graph_width === 96,
							click: () => {
								win.webContents.send("set", {graph_width: 96});
							}
						},
						{
							label: "64",
							type: "checkbox",
							checked: config.graph_width === 64,
							click: () => {
								win.webContents.send("set", {graph_width: 64});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.graph_width === 0,
							click: () => {
								win.webContents.send("set", {graph_width: 0});
							}
						}
					]
				},
				{
					label: "Graph major lines",
					submenu: [
						{
							label: "4",
							type: "checkbox",
							checked: config.major_graph_linewidth === 4,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.major_graph_linewidth === 3,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.major_graph_linewidth === 2,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.major_graph_linewidth === 1,
							click: () => {
								win.webContents.send("set", {major_graph_linewidth: 1});
							}
						},
					]
				},
				{
					label: "Graph minor lines",
					submenu: [
						{
							label: "4",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 4,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 4});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 3,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 3});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 2,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 2});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 1,
							click: () => {
								win.webContents.send("set", {minor_graph_linewidth: 1});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: "Thumbnail squares",
					submenu: [
						{
							label: "8",
							type: "checkbox",
							checked: config.thumbnail_square_size === 8,
							click: () => {
								win.webContents.send("set", {thumbnail_square_size: 8});
							}
						},
						{
							label: "6",
							type: "checkbox",
							checked: config.thumbnail_square_size === 6,
							click: () => {
								win.webContents.send("set", {thumbnail_square_size: 6});
							}
						},
						{
							label: "4",
							type: "checkbox",
							checked: config.thumbnail_square_size === 4,
							click: () => {
								win.webContents.send("set", {thumbnail_square_size: 4});
							}
						},
					]
				},
				{
					type: "separator"
				},
				{
					label: "Tree spacing",
					submenu: [
						{
							label: "48",
							type: "checkbox",
							checked: config.tree_spacing === 48,
							click: () => {
								win.webContents.send("set", {tree_spacing: 48});
							}
						},
						{
							label: "44",
							type: "checkbox",
							checked: config.tree_spacing === 44,
							click: () => {
								win.webContents.send("set", {tree_spacing: 44});
							}
						},
						{
							label: "40",
							type: "checkbox",
							checked: config.tree_spacing === 40,
							click: () => {
								win.webContents.send("set", {tree_spacing: 40});
							}
						},
						{
							label: "36",
							type: "checkbox",
							checked: config.tree_spacing === 36,
							click: () => {
								win.webContents.send("set", {tree_spacing: 36});
							}
						},
						{
							label: "32",
							type: "checkbox",
							checked: config.tree_spacing === 32,
							click: () => {
								win.webContents.send("set", {tree_spacing: 32});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.tree_spacing === 28,
							click: () => {
								win.webContents.send("set", {tree_spacing: 28});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.tree_spacing === 24,
							click: () => {
								win.webContents.send("set", {tree_spacing: 24});
							}
						},
					]
				},
				{
					label: "Comment box",
					submenu: [
						{
							label: "512",
							type: "checkbox",
							checked: config.comment_height === 512,
							click: () => {
								win.webContents.send("set", {comment_height: 512});
							}
						},
						{
							label: "384",
							type: "checkbox",
							checked: config.comment_height === 384,
							click: () => {
								win.webContents.send("set", {comment_height: 384});
							}
						},
						{
							label: "256",
							type: "checkbox",
							checked: config.comment_height === 256,
							click: () => {
								win.webContents.send("set", {comment_height: 256});
							}
						},
						{
							label: "128",
							type: "checkbox",
							checked: config.comment_height === 128,
							click: () => {
								win.webContents.send("set", {comment_height: 128});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.comment_height === 0,
							click: () => {
								win.webContents.send("set", {comment_height: 0});
							}
						},
					]
				},
			]
		},
		{
			label: "Misc",
			submenu: [
				{
					label: "Escape",
					accelerator: "Escape",
					click: () => {
						win.webContents.send("call", "escape");
					}
				},
				{
					type: "separator",
				},
				{
					role: "toggledevtools"
				},
				{
					label: `Show ${config_io.filename}`,
					click: () => {
						electron.shell.showItemInFolder(config_io.filepath);
					}
				},
				{
					type: "separator",
				},
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
				{
					label: "Halt",
					click: () => {
						win.webContents.send("call", "halt");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Log engine stderr to console",
					type: "checkbox",
					checked: config.stderr_to_console,
					click: () => {
						win.webContents.send("toggle", "stderr_to_console");
					}
				},
				{
					label: "Load games at final position",
					type: "checkbox",
					checked: config.load_at_end,
					click: () => {
						win.webContents.send("toggle", "load_at_end");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Show root properties",
					accelerator: "CommandOrControl+P",
					click: () => {
						win.webContents.send("call", {
							fn: "display_props",
							args: [true]
						});
					}
				},
				{
					label: "Show node properties",
					accelerator: "CommandOrControl+Shift+P",
					click: () => {
						win.webContents.send("call", {
							fn: "display_props",
							args: [false]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: "Engine report rate",
					submenu: [
						{
							label: "0.1",
							type: "checkbox",
							checked: config.report_every === 0.1,
							click: () => {
								win.webContents.send("set", {report_every: 0.1});
							}
						},
						{
							label: "0.2",
							type: "checkbox",
							checked: config.report_every === 0.2,
							click: () => {
								win.webContents.send("set", {report_every: 0.2});
							}
						},
						{
							label: "0.4",
							type: "checkbox",
							checked: config.report_every === 0.4,
							click: () => {
								win.webContents.send("set", {report_every: 0.4});
							}
						},
					]
				},
				{
					type: "separator",
				},
			]
		}
	];

	for (let key of Object.keys(colour_choices)) {
		colour_choices_submenu.push({
			label: key,
			click: () => {
				win.webContents.send("call", {
					fn: "apply_colour_settings",
					args: [colour_choices[key]]
				});
			}
		});
	}

	return electron.Menu.buildFromTemplate(template);
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
			throw `get_submenu_items() invalid path: ${menupath}`;
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

	// Since I don't know precisely how the menu works behind the scenes,
	// give a little time for the original click to go through first.

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
