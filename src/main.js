"use strict";

const electron = require("electron");
const path = require("path");
const url = require("url");

const alert = require("./modules/alert_main");
const colour_choices = require("./modules/colour_choices");
const config_io = require("./modules/config_io");
const stringify = require("./modules/stringify");

config_io.load();
let config = config_io.config;

let menu = menu_build();
let menu_is_set = false;
let win;						// We're supposed to keep global references to every window we make.

if (electron.app.isReady()) {
	startup();
} else {
	electron.app.once("ready", () => {
		startup();
	});
}

// --------------------------------------------------------------------------------------------------------------

const save_dialog = electron.dialog.showSaveDialogSync || electron.dialog.showSaveDialog;
const open_dialog = electron.dialog.showOpenDialogSync || electron.dialog.showOpenDialog;

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
		win.show();
		win.focus();
	});

	win.once("close", function(event) {				// Note the once...
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

		// Open files via command line. We must wait until the renderer has properly loaded before we do this.
		// While it might seem like we could do this after "ready-to-show" I'm not 100% sure that the renderer
		// will have fully loaded when that fires.

		let files = [];

		if (path.basename(process.argv[0]).toLowerCase().includes("electron")) {
			if (process.argv.length > 2) {
				files = process.argv.slice(2);
			}
		} else {
			if (process.argv.length > 1) {
				files = process.argv.slice(1);
			}
		}

		if (files.length > 0) {
			win.webContents.send("call", {
				fn: "load_multifile",
				args: [files]
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
		set_checks(...msg);
	});

	electron.ipcMain.on("set_check_false", (event, msg) => {
		set_one_check(false, ...msg);
	});

	electron.ipcMain.on("set_check_true", (event, msg) => {
		set_one_check(true, ...msg);
	});

	electron.ipcMain.on("save_as_required", (event, msg) => {
		let file = save_dialog();
		if (typeof file === "string" && file.length > 0) {
			win.webContents.send("call", {
				fn: "save",
				args: [file]
			});
		}
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
						alert(`${electron.app.getName()} (${electron.app.getVersion()}) in Electron (${process.versions.electron})`);
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
						{
							label: "0",
							click: () => {
								win.webContents.send("call", {
									fn: "place_handicap",
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
					label: "New view into this game",
					accelerator: "CommandOrControl+T",
					click: () => {
						win.webContents.send("call", "new_active_view");
					}
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
						let files = open_dialog({properties: ["multiSelections"]});
						if (Array.isArray(files) && files.length > 0) {
							win.webContents.send("call", {
								fn: "load_multifile",
								args: [files]
							});
						}
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
					label: "Save",
					accelerator: "CommandOrControl+S",
					click: () => {
						win.webContents.send("call", "save_fast");
					}
				},
				{
					label: "Save as...",
					click: () => {
						let file = save_dialog();
						if (typeof file === "string" && file.length > 0) {
							win.webContents.send("call", {
								fn: "save",
								args: [file]
							});
						}
					}
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
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("set", {
								key: "engine",
								value: file
							});
						}
					},
				},
				{
					label: "Locate KataGo config...",
					click: () => {
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("set", {
								key: "engineconfig",
								value: file
							});
						}
					},
				},
				{
					label: "Choose weights...",
					click: () => {
						let files = open_dialog();
						if (Array.isArray(files) && files.length > 0) {
							let file = files[0];
							win.webContents.send("set", {
								key: "weights",
								value: file
							});
						}
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
					label: "Restart engine",
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
					label: "Promote line to main line",
					accelerator: "CommandOrControl+L",
					click: () => {
						win.webContents.send("call", "promote_to_main_line");
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
					accelerator: "Space",											// Likely intercepted by the renderer process, see __start_handlers.js
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
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 10000
								});
								set_checks("Analysis", "Autoanalysis visits", "10000");
							}
						},
						{
							label: "5000",
							type: "checkbox",
							checked: config.autoanalysis_visits === 5000,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 5000
								});
								set_checks("Analysis", "Autoanalysis visits", "5000");
							}
						},
						{
							label: "2500",
							type: "checkbox",
							checked: config.autoanalysis_visits === 2500,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 2500
								});
								set_checks("Analysis", "Autoanalysis visits", "2500");
							}
						},
						{
							label: "1000",
							type: "checkbox",
							checked: config.autoanalysis_visits === 1000,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 1000
								});
								set_checks("Analysis", "Autoanalysis visits", "1000");
							}
						},
						{
							label: "500",
							type: "checkbox",
							checked: config.autoanalysis_visits === 500,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 500
								});
								set_checks("Analysis", "Autoanalysis visits", "500");
							}
						},
						{
							label: "250",
							type: "checkbox",
							checked: config.autoanalysis_visits === 250,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 250
								});
								set_checks("Analysis", "Autoanalysis visits", "250");
							}
						},
						{
							label: "100",
							type: "checkbox",
							checked: config.autoanalysis_visits === 100,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 100
								});
								set_checks("Analysis", "Autoanalysis visits", "100");
							}
						},
						{
							label: "50",
							type: "checkbox",
							checked: config.autoanalysis_visits === 50,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 50
								});
								set_checks("Analysis", "Autoanalysis visits", "50");
							}
						},
						{
							label: "25",
							type: "checkbox",
							checked: config.autoanalysis_visits === 25,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 25
								});
								set_checks("Analysis", "Autoanalysis visits", "25");
							}
						},
						{
							label: "10",
							type: "checkbox",
							checked: config.autoanalysis_visits === 10,
							click: () => {
								win.webContents.send("set", {
									key: "autoanalysis_visits",
									value: 10
								});
								set_checks("Analysis", "Autoanalysis visits", "10");
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
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0
								});
								set_checks("Display", "Visit filter", "All");
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
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.005
								});
								set_checks("Display", "Visit filter", "N > 0.5%");
							}
						},
						{
							label: "N > 1%",
							type: "checkbox",
							checked: config.visits_threshold === 0.01,
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.01
								});
								set_checks("Display", "Visit filter", "N > 1%");
							}
						},
						{
							label: "N > 2%",
							type: "checkbox",
							checked: config.visits_threshold === 0.02,
							accelerator: "F2",
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.02
								});
								set_checks("Display", "Visit filter", "N > 2%");
							}
						},
						{
							label: "N > 4%",
							type: "checkbox",
							checked: config.visits_threshold === 0.04,
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.04
								});
								set_checks("Display", "Visit filter", "N > 4%");
							}
						},
						{
							label: "N > 6%",
							type: "checkbox",
							checked: config.visits_threshold === 0.06,
							accelerator: "F3",
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.06
								});
								set_checks("Display", "Visit filter", "N > 6%");
							}
						},
						{
							label: "N > 8%",
							type: "checkbox",
							checked: config.visits_threshold === 0.08,
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.08
								});
								set_checks("Display", "Visit filter", "N > 8%");
							}
						},
						{
							label: "N > 10%",
							type: "checkbox",
							checked: config.visits_threshold === 0.1,
							accelerator: "F4",
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0.1
								});
								set_checks("Display", "Visit filter", "N > 10%");
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
								win.webContents.send("set", {
									key: "numbers",
									value: "LCB + Visits"
								});
								set_checks("Display", "Numbers", "LCB + Visits");
							}
						},
						{
							label: "Score + Visits",
							type: "checkbox",
							checked: config.numbers === "Score + Visits",
							accelerator: "F6",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Score + Visits"
								});
								set_checks("Display", "Numbers", "Score + Visits");
							}
						},
						{
							label: "Delta + Visits",
							type: "checkbox",
							checked: config.numbers === "Delta + Visits",
							accelerator: "F7",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Delta + Visits"
								});
								set_checks("Display", "Numbers", "Delta + Visits");
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
								win.webContents.send("set", {
									key: "numbers",
									value: "LCB"
								});
								set_checks("Display", "Numbers", "LCB");
							}
						},
						{
							label: "Score",
							type: "checkbox",
							checked: config.numbers === "Score",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Score"
								});
								set_checks("Display", "Numbers", "Score");
							}
						},
						{
							label: "Delta",
							type: "checkbox",
							checked: config.numbers === "Delta",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Delta"
								});
								set_checks("Display", "Numbers", "Delta");
							}
						},
						{
							label: "Visits",
							type: "checkbox",
							checked: config.numbers === "Visits",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Visits"
								});
								set_checks("Display", "Numbers", "Visits");
							}
						},
						{
							label: "Visits (%)",
							type: "checkbox",
							checked: config.numbers === "Visits (%)",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Visits (%)"
								});
								set_checks("Display", "Numbers", "Visits (%)");
							}
						},
						{
							label: "Order",
							type: "checkbox",
							checked: config.numbers === "Order",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Order"
								});
								set_checks("Display", "Numbers", "Order");
							}
						},
						{
							label: "Policy",
							type: "checkbox",
							checked: config.numbers === "Policy",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Policy"
								});
								set_checks("Display", "Numbers", "Policy");
							}
						},
						{
							label: "Winrate",
							type: "checkbox",
							checked: config.numbers === "Winrate",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "Winrate"
								});
								set_checks("Display", "Numbers", "Winrate");
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
							checked: config.graph_type === "winrate",
							accelerator: "F9",
							click: () => {
								win.webContents.send("set", {
									key: "graph_type",
									value: "winrate"
								});
								set_checks("Display", "Graph", "Winrate");
							}
						},
						{
							label: "Score",
							type: "checkbox",
							checked: config.graph_type === "score",
							accelerator: "F10",
							click: () => {
								win.webContents.send("set", {
									key: "graph_type",
									value: "score"
								});
								set_checks("Display", "Graph", "Score");
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
								win.webContents.send("set", {
									key: "square_size",
									value: 72
								});
							}
						},
						{
							label: "68",
							type: "checkbox",
							checked: config.square_size === 68,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 68
								});
							}
						},
						{
							label: "64",
							type: "checkbox",
							checked: config.square_size === 64,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 64
								});
							}
						},
						{
							label: "60",
							type: "checkbox",
							checked: config.square_size === 60,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 60
								});
							}
						},
						{
							label: "56",
							type: "checkbox",
							checked: config.square_size === 56,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 56
								});
							}
						},
						{
							label: "52",
							type: "checkbox",
							checked: config.square_size === 52,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 52
								});
							}
						},
						{
							label: "48",
							type: "checkbox",
							checked: config.square_size === 48,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 48
								});
							}
						},
						{
							label: "44",
							type: "checkbox",
							checked: config.square_size === 44,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 44
								});
							}
						},
						{
							label: "40",
							type: "checkbox",
							checked: config.square_size === 40,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 40
								});
							}
						},
						{
							label: "38",
							type: "checkbox",
							checked: config.square_size === 38,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 38
								});
							}
						},
						{
							label: "36",
							type: "checkbox",
							checked: config.square_size === 36,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 36
								});
							}
						},
						{
							label: "34",
							type: "checkbox",
							checked: config.square_size === 34,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 34
								});
							}
						},
						{
							label: "32",
							type: "checkbox",
							checked: config.square_size === 32,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 32
								});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.square_size === 30,
							click: () => {
								win.webContents.send("set", {
									key: "square_size",
									value: 30
								});
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
								win.webContents.send("set", {
									key: "board_font_size",
									value: 32
								});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.board_font_size === 30,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 30
								});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.board_font_size === 28,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 28
								});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.board_font_size === 26,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 26
								});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.board_font_size === 24,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 24
								});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.board_font_size === 22,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 22
								});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.board_font_size === 20,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 20
								});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.board_font_size === 18,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 18
								});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.board_font_size === 16,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 16
								});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.board_font_size === 14,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 14
								});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.board_font_size === 12,
							click: () => {
								win.webContents.send("set", {
									key: "board_font_size",
									value: 12
								});
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
								win.webContents.send("set", {
									key: "board_line_width",
									value: 4
								});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.board_line_width === 3,
							click: () => {
								win.webContents.send("set", {
									key: "board_line_width",
									value: 3
								});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.board_line_width === 2,
							click: () => {
								win.webContents.send("set", {
									key: "board_line_width",
									value: 2
								});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.board_line_width === 1,
							click: () => {
								win.webContents.send("set", {
									key: "board_line_width",
									value: 1
								});
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
								win.webContents.send("set", {
									key: "info_font_size",
									value: 32
								});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.info_font_size === 30,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 30
								});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.info_font_size === 28,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 28
								});
							}
						},
						{
							label: "26",
							type: "checkbox",
							checked: config.info_font_size === 26,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 26
								});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.info_font_size === 24,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 24
								});
							}
						},
						{
							label: "22",
							type: "checkbox",
							checked: config.info_font_size === 22,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 22
								});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.info_font_size === 20,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 20
								});
							}
						},
						{
							label: "18",
							type: "checkbox",
							checked: config.info_font_size === 18,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 18
								});
							}
						},
						{
							label: "16",
							type: "checkbox",
							checked: config.info_font_size === 16,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 16
								});
							}
						},
						{
							label: "14",
							type: "checkbox",
							checked: config.info_font_size === 14,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 14
								});
							}
						},
						{
							label: "12",
							type: "checkbox",
							checked: config.info_font_size === 12,
							click: () => {
								win.webContents.send("set", {
									key: "info_font_size",
									value: 12
								});
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
								win.webContents.send("set", {
									key: "graph_width",
									value: 512
								});
							}
						},
						{
							label: "480",
							type: "checkbox",
							checked: config.graph_width === 480,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 480
								});
							}
						},
						{
							label: "448",
							type: "checkbox",
							checked: config.graph_width === 448,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 448
								});
							}
						},
						{
							label: "416",
							type: "checkbox",
							checked: config.graph_width === 416,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 416
								});
							}
						},
						{
							label: "384",
							type: "checkbox",
							checked: config.graph_width === 384,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 384
								});
							}
						},
						{
							label: "352",
							type: "checkbox",
							checked: config.graph_width === 352,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 352
								});
							}
						},
						{
							label: "320",
							type: "checkbox",
							checked: config.graph_width === 320,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 320
								});
							}
						},
						{
							label: "288",
							type: "checkbox",
							checked: config.graph_width === 288,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 288
								});
							}
						},
						{
							label: "256",
							type: "checkbox",
							checked: config.graph_width === 256,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 256
								});
							}
						},
						{
							label: "224",
							type: "checkbox",
							checked: config.graph_width === 224,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 224
								});
							}
						},
						{
							label: "192",
							type: "checkbox",
							checked: config.graph_width === 192,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 192
								});
							}
						},
						{
							label: "160",
							type: "checkbox",
							checked: config.graph_width === 160,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 160
								});
							}
						},
						{
							label: "128",
							type: "checkbox",
							checked: config.graph_width === 128,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 128
								});
							}
						},
						{
							label: "96",
							type: "checkbox",
							checked: config.graph_width === 96,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 96
								});
							}
						},
						{
							label: "64",
							type: "checkbox",
							checked: config.graph_width === 64,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 64
								});
							}
						},
						{
							label: "0",
							type: "checkbox",
							checked: config.graph_width === 0,
							click: () => {
								win.webContents.send("set", {
									key: "graph_width",
									value: 0
								});
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
								win.webContents.send("set", {
									key: "major_graph_linewidth",
									value: 4
								});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.major_graph_linewidth === 3,
							click: () => {
								win.webContents.send("set", {
									key: "major_graph_linewidth",
									value: 3
								});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.major_graph_linewidth === 2,
							click: () => {
								win.webContents.send("set", {
									key: "major_graph_linewidth",
									value: 2
								});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.major_graph_linewidth === 1,
							click: () => {
								win.webContents.send("set", {
									key: "major_graph_linewidth",
									value: 1
								});
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
								win.webContents.send("set", {
									key: "minor_graph_linewidth",
									value: 4
								});
							}
						},
						{
							label: "3",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 3,
							click: () => {
								win.webContents.send("set", {
									key: "minor_graph_linewidth",
									value: 3
								});
							}
						},
						{
							label: "2",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 2,
							click: () => {
								win.webContents.send("set", {
									key: "minor_graph_linewidth",
									value: 2
								});
							}
						},
						{
							label: "1",
							type: "checkbox",
							checked: config.minor_graph_linewidth === 1,
							click: () => {
								win.webContents.send("set", {
									key: "minor_graph_linewidth",
									value: 1
								});
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
								win.webContents.send("set", {
									key: "thumbnail_square_size",
									value: 8
								});
							}
						},
						{
							label: "6",
							type: "checkbox",
							checked: config.thumbnail_square_size === 6,
							click: () => {
								win.webContents.send("set", {
									key: "thumbnail_square_size",
									value: 6
								});
							}
						},
						{
							label: "4",
							type: "checkbox",
							checked: config.thumbnail_square_size === 4,
							click: () => {
								win.webContents.send("set", {
									key: "thumbnail_square_size",
									value: 4
								});
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
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 48
								});
							}
						},
						{
							label: "44",
							type: "checkbox",
							checked: config.tree_spacing === 44,
							click: () => {
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 44
								});
							}
						},
						{
							label: "40",
							type: "checkbox",
							checked: config.tree_spacing === 40,
							click: () => {
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 40
								});
							}
						},
						{
							label: "36",
							type: "checkbox",
							checked: config.tree_spacing === 36,
							click: () => {
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 36
								});
							}
						},
						{
							label: "32",
							type: "checkbox",
							checked: config.tree_spacing === 32,
							click: () => {
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 32
								});
							}
						},
						{
							label: "28",
							type: "checkbox",
							checked: config.tree_spacing === 28,
							click: () => {
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 28
								});
							}
						},
						{
							label: "24",
							type: "checkbox",
							checked: config.tree_spacing === 24,
							click: () => {
								win.webContents.send("set", {
									key: "tree_spacing",
									value: 24
								});
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
					click: () => {
						win.webContents.send("call", {
							fn: "display_props",
							args: [true]
						});
					}
				},
				{
					label: "Show node properties",
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
							label: "Fast",
							type: "checkbox",
							checked: config.report_every === 0.1,
							click: () => {
								win.webContents.send("set", {
									key: "report_every",
									value: 0.1
								});
								set_checks("Misc", "Engine report rate", "Fast");
							}
						},
						{
							label: "Medium",
							type: "checkbox",
							checked: config.report_every === 0.2,
							click: () => {
								win.webContents.send("set", {
									key: "report_every",
									value: 0.2
								});
								set_checks("Misc", "Engine report rate", "Medium");
							}
						},
						{
							label: "Slow",
							type: "checkbox",
							checked: config.report_every === 0.4,
							click: () => {
								win.webContents.send("set", {
									key: "report_every",
									value: 0.4
								});
								set_checks("Misc", "Engine report rate", "Slow");
							}
						},
					]
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

	// If the path is to a submenu, this returns a list of all items in the submenu.
	// If the path is to a specific menu item, it just returns that item.

	let o = menu.items;
	for (let p of menupath) {
		p = stringify(p);
		for (let item of o) {
			if (item.label === p) {
				if (item.submenu) {
					o = item.submenu.items;
					break;
				} else {
					return item;		// No submenu so this must be the end.
				}
			}
		}
	}
	return o;
}

function set_checks(...menupath) {

	if (!menu_is_set) {
		return;
	}

	// Since I don't know precisely how the menu works behind the scenes,
	// give a little time for the original click to go through first.

	setTimeout(() => {
		let items = get_submenu_items(menupath.slice(0, -1));
		for (let n = 0; n < items.length; n++) {
			if (items[n].checked !== undefined) {
				items[n].checked = items[n].label === stringify(menupath[menupath.length - 1]);
			}
		}
	}, 50);
}

function set_one_check(state, ...menupath) {

	state = state ? true : false;

	if (!menu_is_set) {
		return;
	}

	let item = get_submenu_items(menupath);
	if (item.checked !== undefined) {
		item.checked = state;
	}
}
