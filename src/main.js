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
			zoomFactor: 1 / electron.screen.getPrimaryDisplay().scaleFactor		// Unreliable, see https://github.com/electron/electron/issues/10572
		}
	});

	win.once("ready-to-show", () => {
		try {
			win.webContents.setZoomFactor(1 / electron.screen.getPrimaryDisplay().scaleFactor);	// This seems to work, note issue 10572 above.
		} catch (err) {
			win.webContents.zoomFactor = 1 / electron.screen.getPrimaryDisplay().scaleFactor;	// The method above "will be removed" in future.
		}
		win.show();
		win.focus();
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
			label: "App",
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
					label: "Quit",
					accelerator: "CommandOrControl+Q",
					role: "quit"
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
					accelerator: "CommandOrControl+P",
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
					label: "Backward",
					accelerator: "Up",			// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "prev");
					}
				},
				{
					label: "Forward",
					accelerator: "Down",		// Likely intercepted by the renderer process, see __start_handlers.js
					click: () => {
						win.webContents.send("call", "next");
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
			/*
				{
					label: "Return to variation start",
					accelerator: "CommandOrControl+E",
					click: () => {
						win.webContents.send("call", "return_to_variation_start");
					}
				},
			*/
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
					accelerator: "Space",
					click: () => {
						win.webContents.send("call", "toggle_ponder");				// Will ack the correct value for the menu check.
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
							click: () => {
								win.webContents.send("set", {
									key: "visits_threshold",
									value: 0
								});
								set_checks("Display", "Visit filter", "All");
							}
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
							label: "Winrate LCB",
							type: "checkbox",
							checked: config.numbers === "lcb",
							accelerator: "F5",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "lcb"
								});
								set_checks("Display", "Numbers", "Winrate LCB");
							}
						},
						{
							label: "Score",
							type: "checkbox",
							checked: config.numbers === "score",
							accelerator: "F6",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "score"
								});
								set_checks("Display", "Numbers", "Score");
							}
						},
						{
							label: "Visits",
							type: "checkbox",
							checked: config.numbers === "visits",
							accelerator: "F7",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "visits"
								});
								set_checks("Display", "Numbers", "Visits");
							}
						},
						{
							label: "Visits %",
							type: "checkbox",
							checked: config.numbers === "visits (%)",
							accelerator: "F8",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "visits (%)"
								});
								set_checks("Display", "Numbers", "Visits %");
							}
						},
						{
							label: "Order",
							type: "checkbox",
							checked: config.numbers === "order",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "order"
								});
								set_checks("Display", "Numbers", "Order");
							}
						},
						{
							label: "Policy",
							type: "checkbox",
							checked: config.numbers === "policy",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "policy"
								});
								set_checks("Display", "Numbers", "Policy");
							}
						},
						{
							label: "Winrate",
							type: "checkbox",
							checked: config.numbers === "winrate",
							click: () => {
								win.webContents.send("set", {
									key: "numbers",
									value: "winrate"
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
					click: () => {
						win.webContents.send("toggle", "candidate_moves");
					}
				},
				{
					label: "...with PV mouseover",
					type: "checkbox",
					checked: config.mouseover_pv,
					click: () => {
						win.webContents.send("toggle", "mouseover_pv");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Next move markers",
					type: "checkbox",
					checked: config.next_move_markers,
					click: () => {
						win.webContents.send("toggle", "next_move_markers");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Big sizes",
					click: () => {
						win.webContents.send("call", {
							fn: "set_sizes_to_defaults",
							args: [2]
						});
					}
				},
				{
					label: "Reset sizes",
					click: () => {
						win.webContents.send("call", {
							fn: "set_sizes_to_defaults",
							args: [1]
						});
					}
				},
				{
					type: "separator",
				},
				{
					label: "Colours",
					submenu: colour_choices_submenu
				}
			]
		},
		{
			label: "Dev",
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
					label: "Log engine stderr to console",
					type: "checkbox",
					checked: config.stderr_to_console,
					click: () => {
						win.webContents.send("toggle", "stderr_to_console");
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
			]
		}
	];

	for (let key of Object.keys(colour_choices)) {
		colour_choices_submenu.push({
			label: key,
			click: () => {
				win.webContents.send("call", {
					fn: "apply_settings",
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
				items[n].checked = items[n].label === menupath[menupath.length - 1];
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

