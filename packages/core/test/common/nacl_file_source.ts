/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
  getElementReferencedFiles: mockFunction<nacl.NaclFilesSource['getElementReferencedFiles']>(),
  load: mockFunction<nacl.NaclFilesSource['load']>(),
  getSearchableNames: mockFunction<nacl.NaclFilesSource['getSearchableNames']>(),
  getStaticFile: mockFunction<nacl.NaclFilesSource['getStaticFile']>(),
  isPathIncluded: mockFunction<nacl.NaclFilesSource['isPathIncluded']>(),
})
