/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { StaticFile } from '@salto-io/adapter-api'
import { staticFiles } from '@salto-io/workspace'

export const mockStaticFilesSource = (files: StaticFile[] = []): staticFiles.StaticFilesSource => ({
  getStaticFile: jest
    .fn()
    .mockImplementation(
      (args: { filepath: string; encoding: BufferEncoding }) =>
        files.find(sf => sf.filepath === args.filepath) ?? undefined,
    ),
  getContent: jest
    .fn()
    .mockImplementation(
      async (filepath: string) => (await files.find(sf => sf.filepath === filepath)?.getContent()) ?? undefined,
    ),
  persistStaticFile: jest.fn().mockReturnValue([]),
  flush: jest.fn(),
  clone: jest.fn(),
  rename: jest.fn(),
  getTotalSize: jest.fn(),
  clear: jest.fn(),
  delete: jest.fn(),
  isPathIncluded: jest.fn().mockImplementation(filePath => files.find(f => f.filepath === filePath) !== undefined),
})
