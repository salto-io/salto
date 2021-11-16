/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, Element, Change, isObjectType, isStaticFile } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolvePath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { NaclFilesSource, ChangeSet } from '../../src/workspace/nacl_files'
import { Errors } from '../../src/workspace/errors'
import { SourceRange } from '../../src/parser/internal/types'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { createAddChange } from '../../src/workspace/nacl_files/multi_env/projections'
import { mockStaticFilesSource } from '../utils'
import { SourceMap } from '../../src/parser'

const { awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export const createMockNaclFileSource = (
  elements: Element[],
  naclFiles: Record<string, Element[]> = {},
  errors: Errors = new Errors({ merge: [], parse: [], validation: [] }),
  sourceRanges?: SourceRange[],
  changes: ChangeSet<Change> = { changes: [], cacheValid: true },
  staticFileSource = mockStaticFilesSource()
): MockInterface<NaclFilesSource> => {
  let currentElements = elements
  const getElementNaclFiles = (elemID: ElemID): string[] =>
    Object.entries(naclFiles).filter(([_filename, fileElements]) => fileElements.find(
      element => resolvePath(element, elemID) !== undefined
    ) !== undefined).map(([filename, _elements]) => filename)
  return ({
    list: mockFunction<NaclFilesSource['list']>().mockImplementation(async () => awu(currentElements.map(e => e.elemID))),
    isEmpty: mockFunction<NaclFilesSource['isEmpty']>().mockImplementation(async () => currentElements.length === 0),
    get: mockFunction<NaclFilesSource['get']>().mockImplementation(async (id: ElemID) => {
      const { parent, path: idPath } = id.createTopLevelParentID()
      const element = currentElements.find(e => e.elemID.getFullName() === parent.getFullName())
      return element && !_.isEmpty(idPath) ? resolvePath(element, id) : element
    }),
    has: mockFunction<NaclFilesSource['has']>().mockImplementation(async (id: ElemID) => currentElements.find(e => e.elemID.isEqual(id)) !== undefined),
    set: mockFunction<NaclFilesSource['set']>().mockImplementation(async (element: Readonly<Element>) => {
      _.remove(currentElements, e => e.elemID.isEqual(element.elemID))
      currentElements.push(element as Element)
    }),
    setAll: mockFunction<NaclFilesSource['setAll']>().mockImplementation(async (_elements: ThenableIterable<Element>) => Promise.resolve(undefined)),
    delete: mockFunction<NaclFilesSource['delete']>().mockImplementation(async (id: ElemID) => {
      _.remove(currentElements, e => e.elemID.isEqual(id))
    }),
    deleteAll: mockFunction<NaclFilesSource['deleteAll']>().mockImplementation(async (_ids: ThenableIterable<ElemID>) => Promise.resolve(undefined)),
    getAll: mockFunction<NaclFilesSource['getAll']>().mockImplementation(async () => awu(currentElements)),
    getElementsSource: mockFunction<NaclFilesSource['getElementsSource']>().mockImplementation(async () => createInMemoryElementSource(currentElements)),
    clear: mockFunction<NaclFilesSource['clear']>().mockImplementation(async _args => {
      currentElements = []
    }),
    rename: mockFunction<NaclFilesSource['rename']>().mockResolvedValue(),
    flush: mockFunction<NaclFilesSource['flush']>().mockResolvedValue(),
    updateNaclFiles: mockFunction<NaclFilesSource['updateNaclFiles']>().mockResolvedValue(changes),
    listNaclFiles: mockFunction<NaclFilesSource['listNaclFiles']>().mockResolvedValue(_.keys(naclFiles)),
    getTotalSize: mockFunction<NaclFilesSource['getTotalSize']>().mockResolvedValue(5),
    getNaclFile: mockFunction<NaclFilesSource['getNaclFile']>().mockImplementation(
      async filename => (naclFiles[filename] ? { filename, buffer: '' } : undefined)
    ),
    setNaclFiles: mockFunction<NaclFilesSource['setNaclFiles']>().mockResolvedValue(changes),
    removeNaclFiles: mockFunction<NaclFilesSource['removeNaclFiles']>().mockResolvedValue(changes),
    getSourceMap: mockFunction<NaclFilesSource['getSourceMap']>().mockResolvedValue(new SourceMap()),
    getSourceRanges: mockFunction<NaclFilesSource['getSourceRanges']>().mockImplementation(
      async elemID => (
        sourceRanges ?? getElementNaclFiles(elemID).map(filename => ({
          filename,
          start: { byte: 0, line: 1, col: 1 },
          end: { byte: 0, line: 1, col: 1 },
        }))
      )
    ),
    getErrors: mockFunction<NaclFilesSource['getErrors']>().mockResolvedValue(errors),
    getParsedNaclFile: mockFunction<NaclFilesSource['getParsedNaclFile']>().mockImplementation(
      async filename => ({
        filename,
        data: {
          errors: () => Promise.resolve([]),
          referenced: () => Promise.resolve([]),
        },
        elements: () => Promise.resolve(naclFiles[filename] || []),
        buffer: '',
      })
    ),
    getElementNaclFiles: mockFunction<NaclFilesSource['getElementNaclFiles']>().mockImplementation(async elemID => getElementNaclFiles(elemID)),
    clone: jest.fn().mockRejectedValue(new Error('not implemented in mock')),
    getElementReferencedFiles: mockFunction<NaclFilesSource['getElementReferencedFiles']>().mockResolvedValue([]),
    load: mockFunction<NaclFilesSource['load']>().mockResolvedValue({
      changes: currentElements.map(e => createAddChange(e, e.elemID)),
      cacheValid: true,
    }),
    getSearchableNames: mockFunction<NaclFilesSource['getSearchableNames']>().mockResolvedValue(_.uniq(currentElements.flatMap(e => {
      const fieldNames = isObjectType(e)
        ? Object.values(e.fields).map(field => field.elemID.getFullName())
        : []
      return [e.elemID.getFullName(), ...fieldNames]
    }))),
    getStaticFile: mockFunction<NaclFilesSource['getStaticFile']>().mockImplementation(async (filePath, enc) => {
      const sfile = await staticFileSource.getStaticFile(filePath, enc)
      return isStaticFile(sfile)
        ? sfile
        : undefined
    }),
  })
}
