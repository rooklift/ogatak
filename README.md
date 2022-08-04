![Screenshot](https://user-images.githubusercontent.com/16438795/156058144-1bad6a82-3850-44fb-821f-34e56a1a1f21.png)

* Simple analysis GUI for [KataGo](https://github.com/lightvector/KataGo). See [Releases](https://github.com/rooklift/ogatak/releases) for the latest version.
* Stone and board graphics modified from [Sabaki](https://github.com/SabakiHQ/Sabaki), with thanks.
* Concept borrowed from [Lizzie](https://github.com/featurecat/lizzie), with influence from [KaTrain](https://github.com/sanderland/katrain), [CGoban](https://www.gokgs.com/download.jsp), and [LizGoban](https://github.com/kaorahi/lizgoban).
* Original, independent codebase.

## Upsides

* Relatively simple once set up.
* I personally like the aesthetics...
* Has most normal Lizzie-ish features.
* Fully-functional SGF editor.
* Correctly handles many SGF files that trouble other GUIs, especially handicaps and mid-game board edits.
* Can load NGF, GIB, and UGI files (albeit imperfectly).
* No dependencies except Electron, quite easy to run from source, doesn't pull in a zillion npm modules.

## Downsides

* KataGo not included, setup takes at least a minute's effort.
* Electron-based app, everyone hates these (they're big).

## Setup

* Download and unpack Ogatak, KataGo, and a KataGo weights file.
* In Ogatak, select the menu item `Setup` `-->` `Locate KataGo...` (and locate katago.exe)
* In Ogatak, select the menu item `Setup` `-->` `Choose weights...` (and locate the weights file) 

## Performance tips

* The setting to request per-move ownership info from KataGo (see `Analysis` menu) is rather demanding and you should turn it off if you experience any lag.
* Alternatively, consider changing the engine report rate (see `Setup` menu) from the default 0.1 (which is the most intense) to something else.

## About the analysis config file

* KataGo requires an analysis config file. Such a file is provided with KataGo as `analysis_example.cfg`, and Ogatak will use this if it's present, unless you explicitly specify a different file. You might find that changing some settings therein leads to better (or worse) performance. Some have found [these settings](https://github.com/sanderland/katrain/blob/master/katrain/KataGo/analysis_config.cfg) chosen by the KaTrain author to be a bit faster.

## Translations

At the moment, it is possible to translate most of the menu items and some of the GUI text. See `/modules/translate.js` for instructions. Thanks to the following translators: ParmuzinAlexander.

## Talk to me

* I can often be found on the [Computer Go Discord](https://discord.com/invite/5vacH5F).
