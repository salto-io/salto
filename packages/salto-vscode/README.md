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
- Sytax, Merge, and validation error highlighting. 
- Adds a commands for running `salto plan` and `salto apply`
- Browse document symbols
- Browse workspace symbols
- Peek definition
- Goto definition
- Find references
- Show types definition values on hover

## Auto-completion support

![Auto completion](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-auto-completion.gif)

## Syntax Highlighting

![Syntax Highlighting](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/screenshot.png)

## Plan and Apply command execution

You can invoke the command via:
- The commands menu (Press `Cntl+Shift+P` or `⇧⌘P` to open the menu).
- The status bar
- Mac's touch pad

## Error highlighting


### Indexing support


### Browse Document Symbols

Press `Ctrl+Shift+O` or `⇧⌘O` to browse symbols in the current file.

![Browse Document Symbols](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-browse-document-symbols.png)

### Browse Workspace Symbols

Press `Ctrl+T` or `⌘T` to jump to symbol.

![Browse Workspace Symbols](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-browse-workspace-symbols.png)

### Peek and Go To definition

Press `Alt+F12` or `⌥F12` to peek definition.

![Peek definition](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-peek-definition.png)

### Find All References

Press `Shift+F12` or `⇧F12` to find all references (currently only variables).

![Find all references](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-find-references.png)

### Show type definition on hover

![Hover over variable](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-hover-variable.png)

### Outline View support

![An outline of the currently open document is automatically showed](https://raw.githubusercontent.com/mauve/vscode-terraform/master/images/terraform-outline-view.png)


