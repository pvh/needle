# Needle

A starting-poiint for building your own local-first application.

Needle is the PushPin codebase, stripped down to boot into a simple Text component at initial startup.

To make your own application, start by adding a new component in `./src/renderer/components/content-types/` and then modify Workspace to create one at startup. (Yes, this is vague and unhelpful, sorry.)

[Join our Slack to ask questions, share ideas, or meet other users!](https://communityinviter.com/apps/automerge/automerge)

Built with Electron, React, automerge and [hypermerge](https://github.com/automerge/hypermerge).

A project initiated by [Ink & Switch](https://inkandswitch.com/).

## WARNING

Needle is experimental software and currently implements an extremely open and permissive sharing system!

You should be extremely cautious about putting private personal data into Arthropod. While the development team has no access to data in Arthropod, once shared Arthropod links cannot be unshared or redacted!

See [WARNINGS](WARNINGS.md) for more details, and feel free to ask questions in Slack or GitHub issues.

## Running from Source

```console
$ nvm use 12
$ yarn
$ yarn start
```

To enable debug logging, e.g.:

```console
$ DEBUG=* yarn start
$ DEBUG=arthropod:* yarn start
$ DEBUG=arthropod:card,hypermerge:* yarn start
```

To run multiple clients and test syncing:

```console
$ yarn run start2
```

This is an alias for:

```console
$ NAME=userA yarn start & NAME=userB yarn dev:app
```

User data is stored in a platform-dependent, shared location outside of the
source code directory. To get the path to your data directory, run in the
console:

```javascript
> require('./constants').USER_PATH
"/Users/mmcgrana/Library/Application Support/Arthropod/pushpin-v11/mark"
```

On Mac, this is currently: `~/Library/Application Support/arthropod/`.
On Windows, it is: `~\AppData\Roaming\Arthropod`

Per-NAME data is stored under that directory inside `pushpin-v11`. (The number may be higher if you're reading this in the future and we forgot to update the readme.) You can remove a single directory from to reset a user's data, or remove the entire data directory to reset all user data.

## Using PushPin

PushPin is an offline-first collaborative cork board. You can make new text notes by double-clicking, and drag-and-drop or paste in text, images, PDFs, audio files, video files, URLs, or even arbitrary other files to a board.

You can also drag boards and contacts from the search bar onto a board, right click to create new elements like conversation threads or change the background color of a board.

In the top left is your avatar image. Double-click it to begin editing your profile. Give yourself a name and a profile picture, then invite someone else to see your work by clicking the clipboard in the search box to copy the URL.

They'll have to paste that link into their search bar and with that, you'll be connected.

You can navigate new places quickly by pressing "/" and then typing part of the name of the board you want to go to or the person you want to share your current view with.

## Keeping Your Data Available

[pushpin-peer](https://github.com/mjtognetti/pushpin-peer) is a simple data peer you can use to ensure your pushpin data is available. You can run pushpin peer on a server or in the cloud.

## Hacking on Arthropod

Arthropod is built to be easily extended. You could add new kinds of cards like movies or music, a fancier text editor, a PDF viewer, a deck of cards, or a drum machine. You could replace our card layout with your own code, or build a 3d game using WebGL. The sky's the limit.

See [HACKING](HACKING.md) for a getting started guide.

## Packaging

Create a package for your platform with `yarn dist`.

## Contributing

Please do! Bug reports and pull requests are welcome. Contributions will generally be considered and assessed following our [DESIGN](DESIGN.md) guidelines, though we may accept or reject a patch for any reason.

## Credits

This project was written by

- Roshan Choxi
- Ignatius Gilfedder
- Mark McGranaghan
- Jeff Peterson
- Matt Tognetti
- Peter van Hardenberg
- Geoffrey Litt
  and was produced under the auspices of [Ink & Switch](inkandswitch.com).

Special thanks to Martin Kleppmann (automerge) and Mathias Buus (hypercore) for their advice and contributions.

## Contributions

Thanks in particular to the following individuals for sending bug fixes and feature improvements:

- Jeremy Apthorp
- Irakli Gozala
- Zach Sherman

## Upgrade Hackage Notes

### sodium-native

Compiling sodium-native is a pain. Go into node_modules/sodium-native and run `node preinstall` if you have trouble.

### package.json resolutions

- `"automerge": "github:automerge/automerge#opaque-strings"`
  - Automerge's typescript declarations mess up opaque string types (`string & { foo: bar }`) when
    freezing objects, so we have a branch that supports it. Can remove after that branch is merged
    to automerge.
