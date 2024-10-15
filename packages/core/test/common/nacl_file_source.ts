/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { nacl } from '@salto-io/workspace'

export const createMockNaclFileSource = (): MockInterface<nacl.NaclFilesSource> => ({
  list: mockFunction<nacl.NaclFilesSource['list']>(),
  isEmpty: mockFunction<nacl.NaclFilesSource['isEmpty']>(),
  get: mockFunction<nacl.NaclFilesSource['get']>(),
  has: mockFunction<nacl.NaclFilesSource['has']>(),
  set: mockFunction<nacl.NaclFilesSource['set']>(),
  setAll: mockFunction<nacl.NaclFilesSource['setAll']>(),
  delete: mockFunction<nacl.NaclFilesSource['delete']>(),
  deleteAll: mockFunction<nacl.NaclFilesSource['deleteAll']>(),
  getAll: mockFunction<nacl.NaclFilesSource['getAll']>(),
  getElementsSource: mockFunction<nacl.NaclFilesSource['getElementsSource']>(),
  clear: mockFunction<nacl.NaclFilesSource['clear']>(),
  rename: mockFunction<nacl.NaclFilesSource['rename']>(),
  flush: mockFunction<nacl.NaclFilesSource['flush']>(),
  updateNaclFiles: mockFunction<nacl.NaclFilesSource['updateNaclFiles']>(),
  listNaclFiles: mockFunction<nacl.NaclFilesSource['listNaclFiles']>(),
  getTotalSize: mockFunction<nacl.NaclFilesSource['getTotalSize']>(),
  getNaclFile: mockFunction<nacl.NaclFilesSource['getNaclFile']>(),
  setNaclFiles: mockFunction<nacl.NaclFilesSource['setNaclFiles']>(),
  removeNaclFiles: mockFunction<nacl.NaclFilesSource['removeNaclFiles']>(),
  getSourceMap: mockFunction<nacl.NaclFilesSource['getSourceMap']>(),
  getSourceRanges: mockFunction<nacl.NaclFilesSource['getSourceRanges']>(),
  getErrors: mockFunction<nacl.NaclFilesSource['getErrors']>(),
  getParsedNaclFile: mockFunction<nacl.NaclFilesSource['getParsedNaclFile']>(),
  getElementNaclFiles: mockFunction<nacl.NaclFilesSource['getElementNaclFiles']>(),
  getElementFileNames: mockFunction<nacl.NaclFilesSource['getElementFileNames']>(),
  clone: mockFunction<nacl.NaclFilesSource['clone']>(),
  load: mockFunction<nacl.NaclFilesSource['load']>(),
  getSearchableNames: mockFunction<nacl.NaclFilesSource['getSearchableNames']>(),
  getStaticFile: mockFunction<nacl.NaclFilesSource['getStaticFile']>(),
  isPathIncluded: mockFunction<nacl.NaclFilesSource['isPathIncluded']>(),
})
