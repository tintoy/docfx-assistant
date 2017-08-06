# DocFX assistant

An extension for VS Code that provides tools for authoring content using Microsoft DocFX.

![DocFX Assistant in action](docs/images/DocFX-extension.gif)

## Usage

When your workspace contains a DocFX project, press one of the following key combinations to bring up a pick-list of available topic UIDs:

* `ctrl+shift+alt+u a`: Any topic
* `ctrl+shift+alt+u c`: Conceptual topics
* `ctrl+shift+alt+u n`: Namespace topics
* `ctrl+shift+alt+u t`: Type (class, struct, interface) topics
* `ctrl+shift+alt+u p`: Property topics
* `ctrl+shift+alt+u m`: Method topics

These commands are also available from the command pallette with the prefix "DocFX:".

To refresh the list of available topics, use the "DocFX: Refresh topic UIDs" command.

## Installation

Since this extension is not available from the VS gallery yet, simply [download](https://github.com/tintoy/docfx-assistant/releases/latest) the VSIX package for the latest release and install it by choosing "Install from VSIX" from the menu on the top right of the extensions panel.

## Known issues

Unless configured otherwise, the extension will automatically start scanning and updating in the background as soon as it starts (or you open a workspace with `docfx.json` in the root directory).

It does not automatically scan new / modified files, but will rescan if you open different folder as the workspace root (a future release will also watch for file changes and update acordingly).

Additionally, the design of this extension is a little quick-and-dirty; it works well, but the internals are a little-too-tightly coupled to the VSCode API for comfort. There are no tests either, yet.

## Questions / bug reports

If you have questions, feature requests, or would like to report a bug, please feel free to reach out by creating an issue. When reporting a bug, please try to include as much information as possible about what you were doing at the time, what you expected to happen, and what actually happened.

If you're interested in collaborating that'd be great, too :-)
