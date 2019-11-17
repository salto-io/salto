<!-- markdownlint-disable -->
<h1 align="center">
  vscode-salto
</h1>

---

<h4 align="center"Configure, preview and deploy .<a href="https://www.salto.io/">Salto</a> patches in vscode.</h4>

---

## Features at a glance

- Auto-completion support.
- Syntax highlighting for `.bp` files.
- Syntax, Merge, and validation error highlighting. 
- Adds commands for running `salto preview` and `salto deploy`
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
- Note: On version updates you might need to manually delete the extension directory in `$home/.vscode/extensions`

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

