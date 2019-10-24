<!-- markdownlint-disable -->
<h1 align="center">
  vscode-salto
</h1>

---

<h4 align="center"Configure, plan and apply .<a href="https://www.salto.io/">Salto</a> patches in vscode.</h4>

---

[![CircleCI](https://circleci.com/gh/salto-io/salto.svg?style=shield&circle-token=e64029d1886e2965a8d51b09597054b5a1e84733)](https://circleci.com/gh/salto-io/salto) &nbsp; &nbsp; [![codecov](https://codecov.io/gh/salto-io/salto/branch/master/graph/badge.svg?token=iZeoxV5WBR)](https://codecov.io/gh/salto-io/salto)

## Features at a glance

- Auto-completion support.
- Syntax highlighting for `.bp` files.
- Syntax, Merge, and validation error highlighting. 
- Adds commands for running `salto plan` and `salto apply`
- Browse document symbols
- Browse workspace symbols
- Peek definition
- Goto definition
- Find references
- Show types definition values on hover

## Installation
Salto is still not registered in the marketplace. To install:
- Download the latest vsix file
- Open the extension menu
- Select install from .vsix
- Choose the downloaded file
- Note: On version updates you might need to manualy delete the extension directory in `$home/.vscode/extensions`

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/install.gif" alt="Installation" width="720"/>

## Auto-completion support

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/autocomplete.gif" alt="Auto completion" width="720"/>

## Syntax Highlighting


<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/syntax.png" alt="Syntax" width="720"/>

## Plan and Apply command execution

You can invoke the command via:
- The commands menu (Press `Ctrl+Shift+P` or `⇧⌘P` to open the menu)
- The status bar
- Mac's touch bar

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/apply.gif" alt="Commands" width="720"/>

## Error highlighting

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/errors.gif" alt="errors" width="720"/>

### Indexing support
- Press `Ctrl+Shift+O` or `⇧⌘O` to browse symbols in the current file
- Press `Ctrl+T` or `⌘T` to jump to symbol
- Press `Alt+F12` or `⌥F12` to peek definition
- Show type definition on hover
- Outline view support

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/indexing.gif" alt="indexing" width="720"/>

