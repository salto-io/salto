<!-- markdownlint-disable -->
<h1 align="center">
  vscode-salto
</h1>

---

<h4 align="center"Configure, preview and deploy .<a href="https://www.salto.io/">Salto</a> patches in vscode.</h4>

---

## Features at a glance

- Auto-completion support.
- Syntax highlighting for `.nacl` files.
- Syntax, Merge, and validation error highlighting. 
- Browse document symbols
- Browse workspace symbols
- Peek definition
- Goto definition
- Find references
- Show types definition values on hover
- Copy salto reference

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

## Error highlighting

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/errors.gif" alt="errors" width="720"/>

### Indexing support
- Press `Ctrl+Shift+O` or `⇧⌘O` to browse symbols in the current file
- Press `Ctrl+T` or `⌘T` to jump to symbol
- Press `Alt+F12` or `⌥F12` to peek definition
- Show type definition on hover
- Outline view support

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/indexing.gif" alt="indexing" width="720"/>

### Copy Salto reference 
 - Right click on the attribute, value, type or instance you would like to reference and select Copy Salto Reference from the menu.

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/copy_ref.gif" alt="indexing" width="594"/>
