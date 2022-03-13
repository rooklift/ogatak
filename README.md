![Screenshot](https://user-images.githubusercontent.com/16438795/156058144-1bad6a82-3850-44fb-821f-34e56a1a1f21.png)

* Simple analysis GUI for [KataGo](https://github.com/lightvector/KataGo). See [Releases](https://github.com/rooklift/ogatak/releases) for the latest version.
* Stone and board graphics modified from [Sabaki](https://github.com/SabakiHQ/Sabaki), with thanks.
* Concept borrowed from [Lizzie](https://github.com/featurecat/lizzie), with influence from [KaTrain](https://github.com/sanderland/katrain), [CGoban](https://www.gokgs.com/download.jsp), and [LizGoban](https://github.com/kaorahi/lizgoban).
* Original, independent codebase.

## Upsides

* Relatively simple once set up.
* I personally like the aesthetics...
* Has most normal Lizzie-ish features.
* Correctly handles many SGF files that trouble other GUIs, especially handicaps and mid-game board edits.
* No dependencies except Electron, quite easy to run from source, doesn't pull in a zillion npm modules.

## Downsides

* KataGo not included, setup takes at least a minute's effort.
* Not quite a full SGF editor (cannot edit game properties such as player names yet).
* Electron-based app, everyone hates these (they're big).

## Performance tips

* The setting to request per-move ownership info from KataGo (see Analysis menu) is rather demanding and you should turn it off if you experience any lag.
* Alternatively, consider changing the engine report rate (see Misc menu) from the default 0.1 (which is the most intense) to something else.

## Talk to me

* I can often be found on the [Computer Go Discord](https://discord.com/invite/5vacH5F).
