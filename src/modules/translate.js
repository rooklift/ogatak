"use strict";

let translations = Object.create(null);
let startup_language = config.language;

// Note to anyone who wants to add a translation:
//
// Create an object in this file that follows the format of the English object.
// Do NOT edit the capital letters part, only the strings on the right hand side.
// Then send me a pull request.
//
// For example, if you were creating a Simplified Chinese translation, you would make:
//
//		translations["简体中文"] = {
//			MENU_FILE: "文件",
//			// etc etc
//		}
//
// Note that it is OK for some keys to be missing (English will be used for those).
//
// You can test things by setting the "language" setting in Ogatak's config.json file
// to be the language you are creating.

translations["English"] = {

	MENU_FILE: "File",

		MENU_ABOUT: "About",
		MENU_NEW_BOARD: "New board",
		MENU_NEW_SMALL_BOARD: "New small board",
		MENU_NEW_RECTANGULAR_BOARD: "New rectangular board",
		MENU_HANDICAP: "Handicap",
		MENU_CLOSE_TAB: "Close tab",
		MENU_OPEN: "Open...",
		MENU_PASTE_SGF: "Paste SGF",
		MENU_SAVE_GAME: "Save game",
		MENU_SAVE_GAME_AS: "Save game as...",
		MENU_SAVE_COLLECTION_AS: "Save collection as...",
		MENU_QUIT: "Quit",

	MENU_SETUP: "Setup",

		MENU_LOCATE_KATAGO: "Locate KataGo...",
		MENU_LOCATE_KATAGO_ANALYSIS_CONFIG: "Locate KataGo analysis config...",
		MENU_CHOOSE_WEIGHTS: "Choose weights...",
		MENU_LAUNCH_KATAGO_VIA_COMMAND: "Launch KataGo via command...",
		MENU_CLEAR_CACHE: "Clear cache",
		MENU_RESTART: "Restart",
		MENU_ENGINE_REPORT_RATE: "Engine report rate",

	MENU_TREE: "Tree",

		MENU_PLAY_BEST_MOVE: "Play best move",
		MENU_PASS: "Pass",
		MENU_ROOT: "Root",
		MENU_END: "End",
		MENU_BACKWARD: "Backward",
		MENU_FORWARD: "Forward",
		MENU_BACKWARD_10: "Backward 10",
		MENU_FORWARD_10: "Forward 10",
		MENU_PREVIOUS_SIBLING: "Previous sibling",
		MENU_NEXT_SIBLING: "Next sibling",
		MENU_RETURN_TO_MAIN_LINE: "Return to main line",
		MENU_FIND_PREVIOUS_FORK: "Find previous fork",
		MENU_FIND_NEXT_FORK: "Find next fork",
		MENU_PROMOTE_LINE: "Promote line",
		MENU_PROMOTE_LINE_TO_MAIN_LINE: "Promote line to main line",
		MENU_DELETE_NODE: "Delete node",
		MENU_DELETE_ALL_PREVIOUS_FORKS: "Delete all previous forks",

	MENU_TOOLS: "Tools",

		MENU_NORMAL: "Normal",
		MENU_ADD_BLACK: "Add Black",
		MENU_ADD_WHITE: "Add White",
		MENU_ADD_EMPTY: "Add Empty",
		MENU_TRIANGLE: "Triangle",
		MENU_SQUARE: "Square",
		MENU_CIRCLE: "Circle",
		MENU_CROSS: "Cross",
		MENU_LABELS_ABC: "Labels (ABC)",
		MENU_LABELS_123: "Labels (123)",
		MENU_TOGGLE_ACTIVE_PLAYER: "Toggle active player",
		MENU_GAME_INFO_EDITOR: "Game info editor",

	MENU_ANALYSIS: "Analysis",

		MENU_GO_HALT_TOGGLE: "Go / halt toggle", 
		MENU_GO: "Go",
		MENU_HALT: "Halt",
		MENU_SELF_PLAY: "Self-play",
		MENU_AUTOANALYSIS: "Autoanalysis",
		MENU_BACKWARD_ANALYSIS: "Backward analysis",
		MENU_AUTOANALYSIS_VISITS: "Autoanalysis visits",
		MENU_SET_RULES: "Set rules",
			MENU_CHINESE: "Chinese",
			MENU_JAPANESE: "Japanese",
			MENU_STONE_SCORING: "Stone Scoring",
		MENU_SET_KOMI: "Set komi",
		MENU_PV_LENGTH_MAX: "PV length (max)",
		MENU_WIDE_ROOT_NOISE: "Wide root noise",
		MENU_SYMMETRY_PRUNING: "Symmetry pruning",
		MENU_OWNERSHIP: "Ownership",
		MENU_PER_MOVE: "...per-move (costly)",
		MENU_CLEAR_ALL_ANALYSIS: "Clear all analysis",

	MENU_DISPLAY: "Display",

		MENU_VISIT_FILTER: "Visit filter",
			MENU_ALL: "All",
		MENU_NUMBERS: "Numbers",
		MENU_GRAPH: "Graph",
		MENU_BLACK_POV_ALWAYS: "Black POV always",
		MENU_CANDIDATE_MOVES: "Candidate moves",
		MENU_WITH_PV_MOUSEOVER: "...with PV mouseover",
		MENU_FADE_BY_VISITS: "...fade by visits",
		MENU_NEXT_MOVE_MARKERS: "Next move markers",
		MENU_COLOURS: "Colours",

	MENU_SIZES: "Sizes",

		MENU_EMBIGGEN_SMALL_BOARDS: "Embiggen small boards",
		MENU_INFO_FONT: "Info font",
		MENU_GRAPH_WIDTH: "Graph width",
		MENU_GRAPH_MAJOR_LINES: "Graph major lines",
		MENU_GRAPH_MINOR_LINES: "Graph minor lines",
		MENU_BOARD_LINES: "Board lines",
		MENU_THUMBNAIL_SQUARES: "Thumbnail squares",
		MENU_TREE_SPACING: "Tree spacing",
		MENU_COMMENT_BOX: "Comment box",

	MENU_MISC: "Misc",

		MENU_ESCAPE: "Escape",
		MENU_PLAY_BLACK: "Play Black",
		MENU_PLAY_WHITE: "Play White",
		MENU_LOAD_GAMES_AT_FINAL_POSITION: "Load games at final position",
		MENU_GUESS_RULES_FROM_KOMI_ON_LOAD: "Guess rules from komi on load",
		MENU_PREFER_TYGEM_HANDICAP_3_LAYOUT: "Prefer Tygem handicap-3 layout",
		MENU_ENABLE_HARDWARE_ACCELERATION_FOR_GUI: "Enable hardware acceleration for GUI",

	MENU_DEV: "Dev",

		MENU_SHOW_ROOT_PROPERTIES: "Show root properties",
		MENU_SHOW_NODE_PROPERTIES: "Show node properties",
		MENU_SHOW_ENGINE_STDERR: "Show engine stderr",
		MENU_ZOBRIST_MISMATCH_CHECKS: "Zobrist mismatch checks",
		MENU_RESET_MISMATCH_WARNINGS: "Reset mismatch warnings",
		MENU_SHOW_CONFIG_FILE: "Show config file",
		MENU_TOGGLE_DEV_TOOLS: "Toggle dev tools",

	// Items that show on first run, when KataGo (etc) have not been located...
	GUI_ENGINE_NOT_SET: "Engine not set.",
	GUI_ENGINE_CONFIG_NOT_SET: "Engine config not set.",
	GUI_WEIGHTS_NOT_SET: "Weights not set.",

	// Message that shows at startup while KataGo loads...
	GUI_AWAITING_RESPONSE_1: "Awaiting response from engine. If needed, select the",
	GUI_AWAITING_RESPONSE_2: "menu item for more info.",

	// Info editor strings...
	INFO_BLACK: "Black",
	INFO_BLACK_RANK: "BR",
	INFO_WHITE: "White",
	INFO_WHITE_RANK: "WR",
	INFO_EVENT: "Event",
	INFO_ROUND: "Round",
	INFO_GAME_NAME: "Name",
	INFO_PLACE: "Place",
	INFO_DATE: "Date",
	INFO_RESULT: "Result",

	// Alerts...
	ALERT_RESTART_REQUIRED: "A restart of the GUI is now required.",

	// About box...
	ABOUT_FILE_LOCATIONS: "Engine, engine config, and weights are at:",
	ABOUT_CONFIG_LOCATION: "Ogatak config file is at:",
	ABOUT_RAM_USAGE: "RAM usage (MB) (engine not included):",

	// Message that shows if config.json cannot be parsed...
	BAD_CONFIG_1: "config file could not be parsed.",
	BAD_CONFIG_2: "It will not be saved to until you fix this.",
	BAD_CONFIG_3: "This means your settings will not be saved.",
	BAD_CONFIG_4: "You should fix this.",
	BAD_CONFIG_5: "You can also just delete the file.",

};

translations["русский"] = {

	MENU_FILE: "Файл",

		MENU_ABOUT: "О программе",
		MENU_NEW_BOARD: "Новая доска",
		MENU_NEW_SMALL_BOARD: "Новая маленькая доска",
		MENU_NEW_RECTANGULAR_BOARD: "Новая прямоугольная доска",
		MENU_HANDICAP: "Фора",
		MENU_CLOSE_TAB: "Закрыть вкладку",
		MENU_OPEN: "Открыть...",
		MENU_PASTE_SGF: "Вставить SGF",
		MENU_SAVE_GAME: "Сохранить игру",
		MENU_SAVE_GAME_AS: "Сохранить игру как...",
		MENU_SAVE_COLLECTION_AS: "Сохранить коллекцию как...",
		MENU_QUIT: "Выход",

	MENU_SETUP: "Установка",

		MENU_LOCATE_KATAGO: "Исполняемый файл KataGo...",
		MENU_LOCATE_KATAGO_ANALYSIS_CONFIG: "Файл настроек анализа...",
		MENU_CHOOSE_WEIGHTS: "Файл сети...",
		MENU_LAUNCH_KATAGO_VIA_COMMAND: "Запуск KataGo с помощью команды...",
		MENU_CLEAR_CACHE: "Очистить кэш",
		MENU_RESTART: "Перезапуск",
		MENU_ENGINE_REPORT_RATE: "Частота отчетов",

	MENU_TREE: "Дерево игры",

		MENU_PLAY_BEST_MOVE: "Сделать лучший ход",
		MENU_PASS: "Пас",
		MENU_ROOT: "Начальная позиция",
		MENU_END: "Конечная позиция",
		MENU_BACKWARD: "Назад",
		MENU_FORWARD: "Вперёд",
		MENU_BACKWARD_10: "Назад на 10 ходов",
		MENU_FORWARD_10: "Вперёд на 10 ходов",
		MENU_PREVIOUS_SIBLING: "Предыдущая ветвь",
		MENU_NEXT_SIBLING: "Следующая ветвь",
		MENU_RETURN_TO_MAIN_LINE: "К главной ветви",
		MENU_FIND_PREVIOUS_FORK: "Предыдущая развилка",
		MENU_FIND_NEXT_FORK: "Следующая развилка",
		MENU_PROMOTE_LINE: "Повысить ветвь",
		MENU_PROMOTE_LINE_TO_MAIN_LINE: "Сделать главной ветвью",
		MENU_DELETE_NODE: "Удалить ход",
		MENU_DELETE_ALL_PREVIOUS_FORKS: "Удалить другие ветви",

	MENU_TOOLS: "Инструменты",

		MENU_NORMAL: "Обычный",
		MENU_ADD_BLACK: "Чёрный камень",
		MENU_ADD_WHITE: "Белый камень",
		MENU_ADD_EMPTY: "Стереть камень",
		MENU_TRIANGLE: "Треугольник",
		MENU_SQUARE: "Квадрат",
		MENU_CIRCLE: "Круг",
		MENU_CROSS: "Крестик",
		MENU_LABELS_ABC: "Буква",
		MENU_LABELS_123: "Цифра",
		MENU_TOGGLE_ACTIVE_PLAYER: "Смена игрока",
		MENU_GAME_INFO_EDITOR: "Редактировать информацию об игре",

	MENU_ANALYSIS: "Анализ",

		MENU_GO_HALT_TOGGLE: "Запустить / остановить", 
		MENU_GO: "Запустить",
		MENU_HALT: "Остановить",
		MENU_SELF_PLAY: "Игра сам с собой",
		MENU_AUTOANALYSIS: "Автоматический анализ",
		MENU_BACKWARD_ANALYSIS: "Автоматический анализ назад",
		MENU_AUTOANALYSIS_VISITS: "Глубина автоматического анализа",
		MENU_SET_RULES: "Правила",
			MENU_CHINESE: "Китайские",
			MENU_JAPANESE: "Японские",
			MENU_STONE_SCORING: "Древние китайские",
		MENU_SET_KOMI: "Коми",
		MENU_PV_LENGTH_MAX: "Количество предлагаемых ходов",
		MENU_WIDE_ROOT_NOISE: "Широкий корневой шум",
		MENU_SYMMETRY_PRUNING: "Симметричность",
		MENU_OWNERSHIP: "Влияние",
		MENU_PER_MOVE: "...каждый ход",
		MENU_CLEAR_ALL_ANALYSIS: "Очистить анализ",

	MENU_DISPLAY: "Вид",

		MENU_VISIT_FILTER: "Фильтр предлагаемых ходов",
			MENU_ALL: "Всё",
		MENU_NUMBERS: "Числа",
		MENU_GRAPH: "График",
		MENU_BLACK_POV_ALWAYS: "Всегда за чёрных",
		MENU_CANDIDATE_MOVES: "Предложение хода",
		MENU_WITH_PV_MOUSEOVER: "...ветвь при наведении курсора",
		MENU_FADE_BY_VISITS: "...цвет от глубины анализа",
		MENU_NEXT_MOVE_MARKERS: "Показывать следующий ход",
		MENU_COLOURS: "Цвета",

	MENU_SIZES: "Размер",

		MENU_EMBIGGEN_SMALL_BOARDS: "Растянуть маленькие доски",
		MENU_INFO_FONT: "Шрифт информации",
		MENU_GRAPH_WIDTH: "Ширина графика",
		MENU_GRAPH_MAJOR_LINES: "Основная линия графика",
		MENU_GRAPH_MINOR_LINES: "Дополнительная линия графика",
		MENU_BOARD_LINES: "Линии на доске",
		MENU_THUMBNAIL_SQUARES: "Миниатюры",
		MENU_TREE_SPACING: "Дерево игры",
		MENU_COMMENT_BOX: "Комментарии",

	MENU_MISC: "Разное",

		MENU_ESCAPE: "Уйти",
		MENU_PLAY_BLACK: "Играть за чёрных",
		MENU_PLAY_WHITE: "Играть за белых",
		MENU_LOAD_GAMES_AT_FINAL_POSITION: "Конечная позиция после загрузки файла",
		MENU_GUESS_RULES_FROM_KOMI_ON_LOAD: "Угадывать правила по коми",
		MENU_PREFER_TYGEM_HANDICAP_3_LAYOUT: "Расположение трёх камней форы как на Tygem",
		MENU_ENABLE_HARDWARE_ACCELERATION_FOR_GUI: "Включить аппаратное ускорение для графического интерфейса",

	MENU_DEV: "Разработка",

		MENU_SHOW_ROOT_PROPERTIES: "Свойства файла",
		MENU_SHOW_NODE_PROPERTIES: "Свойства хода",
		MENU_SHOW_ENGINE_STDERR: "Журнал программы",
		MENU_ZOBRIST_MISMATCH_CHECKS: "Zobrist проверка несоответствий",
		MENU_RESET_MISMATCH_WARNINGS: "Сброс предупреждений о несоответствии",
		MENU_SHOW_CONFIG_FILE: "Показать файл настроек",
		MENU_TOGGLE_DEV_TOOLS: "Инструменты разработки",

	GUI_ENGINE_NOT_SET: "Исполняемый файл KataGo не установлен.",
	GUI_ENGINE_CONFIG_NOT_SET: "Файл настроек анализа не установлен.",
	GUI_WEIGHTS_NOT_SET: "Файл сети не установлен.",

	GUI_AWAITING_RESPONSE_1: "Ожидание ответа от программы. При необходимости выберите",
	GUI_AWAITING_RESPONSE_2: "пункт меню для получения дополнительной информации.",

	INFO_BLACK: "Игрок чёрными",
	INFO_BLACK_RANK: "Ранг чёрных",
	INFO_WHITE: "Игрок белыми",
	INFO_WHITE_RANK: "Ранг белых",
	INFO_EVENT: "Турнир",
	INFO_ROUND: "Тур",
	INFO_GAME_NAME: "Название",
	INFO_PLACE: "Место",
	INFO_DATE: "Дата",
	INFO_RESULT: "Результат",

	ALERT_RESTART_REQUIRED: "Теперь требуется перезапуск графического интерфейса.",

	ABOUT_FILE_LOCATIONS: "Расположение KataGo, настроек анализа и файла сети:",
	ABOUT_CONFIG_LOCATION: "Расположение файла настроек Ogatak:",
	ABOUT_RAM_USAGE: "Использование оперативной памяти (Мбайт):",

	BAD_CONFIG_1: "Не удалось проанализировать файл настроек.",
	BAD_CONFIG_2: "Он не будет сохранен до тех пор, пока вы не исправите это.",
	BAD_CONFIG_3: "Это означает, что ваши настройки не будут сохранены.",
	BAD_CONFIG_4: "Вы должны это исправить.",
	BAD_CONFIG_5: "Вы также можете просто удалить файл.",

};


function translate(key, force_language = null) {

	// Note that we usually use the language which was in config.json at startup so
	// that in-flight calls to translate() return consistent results even if the user
	// switches config.language at some point. (Thus, the user will need to restart
	// to see any change.)

	let language = force_language || startup_language;

	if (translations[language] && translations[language][key]) {
		return translations[language][key];
	} else if (translations["English"] && translations["English"][key]) {
		return translations["English"][key];
	} else {
		return key;
	}

}



// Validate dictionaries... (every key should be in the English version)

for (let language of Object.keys(translations)) {
	for (let key of Object.keys(translations[language])) {
		if (!translations["English"].hasOwnProperty(key)) {
			throw `Bad key (${key}) in language dictionary ${language}`;
		}
	}
}

// Some code to print all translations from a dictionary...
/*
if (global.process && global.process.type === "renderer") {
	let arr = [];
	for (let value of Object.values(translations["English"])) {
		arr.push(value);
	}
	console.log(arr.join("\n"));
}
*/


module.exports = {translate};
