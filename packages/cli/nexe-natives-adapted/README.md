# NEXE Natives

NEXE automatically bundles resources that often include node modules with
natives (i.e. `native.node`). However, this will cause problems with the
compiled binary due to the way the NEXE Virtual FS works. This is demonstrated
when the internal NEXE bundled node module attempts to use `require()` to import
a `native.node` file. In this case an error will be thrown as it will not be
found. This is due to `require()` not looking within the NEXE Virtual FS to
resolve the path.

This library allows native modules in the bundled node application to function
as expected.

The way this is accomplished is by moving (at run time) the specific node module
outside of any paths referenced as 'resources' in the NEXE build options. When
the NEXE binary first executes, it copies the module with natives from within
the binary to a path on the local file system that is not part of the NEXE
Virtual FS and then "requires" it from the copied location.

This library attempts to accomplish this with minimal impact to the original
source code. Once implemented, the node application will continue to work both
as a NEXE binary and when natively.

This setup does NOT require parallel code bases or any automation to include or
modify source files when building the NEXE binary.

## Install

```bash
npm install --save nexe-natives
```

## Implementation Example

Original NON working implementation of node-pty:
```js
const pty = require('node-pty');
```

Modifications to original to allow NEXE binary to use the node-pty library:

```js
const pty = require('nexe-natives')(require.resolve('node-pty'));
```

## Reference

`# NexeNatives(modulePath, opts)`

* `modulePath`: [String] Absolute path to module directory or to a file within
  module directory
* `opts`: [Object]
  * `localPath`: [String] Directory path to where modules should be stored in
    local file system (defaults to `$HOME/.nexe_natives`)
  * `removeOnExit`: [Boolean] Remove copied module path from local file system
    when process terminates (defaults to `true`)


Example 1:

```js
const pty = require('nexe-natives')(require.resolve('node-pty'));
```

Example 2:

```js
const os = require('os');
const path = require('path');

const pty = require('nexe-natives')(path.join(__dirname, '..', 'node_modules', 'node-pty'), {
  localPath: os.tempdir(),
  removeOnExit: true,
});
```

## License

The MIT License (MIT)

Copyright (c) 2020

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
