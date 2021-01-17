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
import { ElemID, Element, Change } from '@salto-io/adapter-api'
import _ from 'lodash'
import path from 'path'
import { resolvePath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { NaclFilesSource } from '../../src/workspace/nacl_files'
import { Errors } from '../../src/workspace/errors'
import { SourceRange } from '../../src/parser/internal/types'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'

const { awu } = collections.asynciterable

export const createMockNaclFileSource = (
  elements: Element[],
  naclFiles: Record<string, Element[]> = {},
  errors: Errors = new Errors({ merge: [], parse: [], validation: [] }),
  sourceRanges?: SourceRange[],
  changes: Change[] = [],
): NaclFilesSource => ({
  list: async () => awu(elements.map(e => e.elemID)),
  isEmpty: async () => elements.length === 0,
  get: async (id: ElemID) => {
    const { parent, path: idPath } = id.createTopLevelParentID()
    const element = elements.find(e => e.elemID.getFullName() === parent.getFullName())
    return element && !_.isEmpty(idPath) ? resolvePath(element, id) : element
  },
  has: async (id: ElemID) => elements.find(e => e.elemID.isEqual(id)) !== undefined,
  set: async (_element: Element) => Promise.resolve(undefined),
  delete: async (_id: ElemID) => Promise.resolve(undefined),
  getAll: async () => awu(elements),
  getElementsSource: async () => createInMemoryElementSource(elements),
  clear: jest.fn().mockImplementation(() => Promise.resolve()),
  rename: jest.fn().mockImplementation(() => Promise.resolve()),
  flush: jest.fn().mockImplementation(() => Promise.resolve()),
  updateNaclFiles: jest.fn().mockImplementation(() => Promise.resolve(changes)),
  listNaclFiles: jest.fn().mockImplementation(() => Promise.resolve(_.keys(naclFiles))),
  getTotalSize: jest.fn().mockImplementation(() => Promise.resolve(5)),
  getNaclFile: jest.fn().mockImplementation(
    (filename: string) => Promise.resolve(naclFiles[filename] ? { filename, buffer: '' } : undefined)
  ),
  setNaclFiles: jest.fn().mockImplementation(() => Promise.resolve(changes)),
  removeNaclFiles: jest.fn().mockImplementation(() => Promise.resolve(changes)),
  getSourceMap: jest.fn().mockImplementation(() => Promise.resolve(new Map())),
  getSourceRanges: jest.fn().mockImplementation(async elemID => sourceRanges
    || _.entries(naclFiles).filter(([_filename, fileElements]) => fileElements.find(
      element => resolvePath(element, elemID) !== undefined
    ) !== undefined).map(([filename, _elements]) => ({
      filename,
      start: {},
      end: {},
    }))),
  getErrors: jest.fn().mockImplementation(() => Promise.resolve(errors)),
  getParsedNaclFile: jest.fn().mockImplementation(async filename => {
    const elementsRc = createInMemoryElementSource(naclFiles[filename] || [])
    return {
      filename,
      errors: [],
      timestamp: Date.now(),
      elements: elementsRc,
      buffer: '',
    }
  }),
  getElementNaclFiles: jest.fn().mockImplementation(() => Promise.resolve([path.join('test', 'path.nacl')])),
  clone: jest.fn().mockImplementation(() => Promise.resolve()),
  getElementReferencedFiles: jest.fn().mockResolvedValue([]),
  load: jest.fn().mockResolvedValue([]),
})
