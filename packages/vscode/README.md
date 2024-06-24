# Salto NACL Configuration Editor

This [VS Code](https://code.visualstudio.com/) extension adds rich support for [Salto](https://salto.io) NACL Configuration files, which represent a business application configuration. By utilizing NACL files, users can easily perform impact analysis on the business application configuration, as well as deploy changes between environments, document these changes using git commits and more. The extension includes syntax highlighting, auto-complete, code navigation, error and warning highlighting, and more!

Check out [Salto's OSS repository](https://github.com/salto-io/salto) for documentation, the code for this extension and more.

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

## Manual Installation

In addition to installing through the [VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=salto-io.salto-vscode), the extension can also be manually installed by downloading a vsix file and manually adding it to your VS Code. Notice that auto-updates will not work if you manually install the extension. To install manually:

- Download the latest vsix file from [here](https://github.com/salto-io/salto/releases/latest)
- Open the extension menu
- Select install from .vsix
- Choose the downloaded file
- Note: On version updates you might need to manually delete the extension directory in `$home/.vscode/extensions`

<img src="https://raw.githubusercontent.com/salto-io/extension_resources/master/install.gif" alt="Installation" width="720"/>
