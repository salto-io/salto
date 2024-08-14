/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import path from 'path'
import { Readable } from 'stream'
import { SourcePath, TreeContainer, ZipTreeContainer } from './salesforce_imports'

// The following implementation is needed to support reading "non-decomposed" component types.
// A bit of background - "decomposed" types are types whose instances are part of their parent XML in metadata format
// but are split into separate files in source format (e.g - CustomObject is decomposed from a giant XML to a folder where
// fields and a lot of other types get their own files).
// "non-decomposed" types are types where this does not happen, meaning, they remain nested in their parent XML in source format.
// In the SFDX code, there is a separate code path for handling non-decomposed types which uses the "readFileSync" method of TreeContainer
// Unfortunately, the base implementation of ZipTreeContainer does not support that method, so, if we were to try and use that
// we would not be able to work with non-decomposed types.
// Hence, we add our own implementation of a ZipTreeContainer that does support "readFileSync" by leveraging the fact that we
// have access to the original contents of the zip in memory anyway in our flow
// TODO: In the future we could probably be more efficient and skip the whole transformation to a zipped buffer and instead
// implement a TreeContainer from scratch
export class SyncZipTreeContainer extends TreeContainer {
  constructor(
    private zipTree: ZipTreeContainer,
    private contents: Map<string, string | Buffer>,
  ) {
    super()
  }

  public exists(fsPath: SourcePath): boolean {
    return this.zipTree.exists(fsPath)
  }

  public isDirectory(fsPath: SourcePath): boolean {
    return this.zipTree.isDirectory(fsPath)
  }

  public readDirectory(fsPath: SourcePath): string[] {
    return this.zipTree.readDirectory(fsPath)
  }

  public readFile(fsPath: SourcePath): Promise<Buffer> {
    return this.zipTree.readFile(fsPath)
  }

  public readFileSync(fsPath: SourcePath): Buffer {
    const content = this.contents.get(path.normalize(fsPath))
    if (content === undefined) {
      // Should never happen
      throw new Error(`Could not get content of ${fsPath}`)
    }
    return Buffer.from(content)
  }

  public stream(fsPath: SourcePath): Readable {
    return this.zipTree.stream(fsPath)
  }
}
