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
import { ElemID, Element, Change, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolvePath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { NaclFilesSource, ChangeSet } from '../../src/workspace/nacl_files'
import { Errors } from '../../src/workspace/errors'
import { SourceRange } from '../../src/parser/internal/types'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { createAddChange } from '../../src/workspace/nacl_files/multi_env/projections'

const { awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export const createMockNaclFileSource = (
  elements: Element[],
  naclFiles: Record<string, Element[]> = {},
  errors: Errors = new Errors({ merge: [], parse: [], validation: [] }),
  sourceRanges?: SourceRange[],
  changes: ChangeSet<Change> = { changes: [], cacheValid: true },
): NaclFilesSource => {
  const currentElements = elements
  const getElementNaclFiles = (elemID: ElemID): string[] =>
    Object.entries(naclFiles).filter(([_filename, fileElements]) => fileElements.find(
      element => resolvePath(element, elemID) !== undefined
    ) !== undefined).map(([filename, _elements]) => filename)
  return ({
    list: async () => awu(currentElements.map(e => e.elemID)),
    isEmpty: async () => currentElements.length === 0,
    get: async (id: ElemID) => {
      const { parent, path: idPath } = id.createTopLevelParentID()
      const element = currentElements.find(e => e.elemID.getFullName() === parent.getFullName())
      return element && !_.isEmpty(idPath) ? resolvePath(element, id) : element
    },
    has: async (id: ElemID) => currentElements.find(e => e.elemID.isEqual(id)) !== undefined,
    set: async (element: Element) => {
      _.remove(currentElements, e => e.elemID.isEqual(element.elemID))
      currentElements.push(element)
    },
    setAll: async (_elements: ThenableIterable<Element>) => Promise.resolve(undefined),
    delete: async (id: ElemID) => {
      _.remove(currentElements, e => e.elemID.isEqual(id))
    },
    deleteAll: async (_ids: ThenableIterable<ElemID>) => Promise.resolve(undefined),
    getAll: async () => awu(currentElements),
    getElementsSource: async () => createInMemoryElementSource(currentElements),
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
      ?? getElementNaclFiles(elemID).map(filename => ({ filename, start: {}, end: {} }))),
    getErrors: jest.fn().mockImplementation(() => Promise.resolve(errors)),
    getParsedNaclFile: jest.fn().mockImplementation(async filename => ({
      filename,
      data: {
        errors: () => Promise.resolve([]),
        timestamp: () => Promise.resolve(Date.now()),
        referenced: () => Promise.resolve([]),
      },
      elements: () => Promise.resolve(naclFiles[filename] || []),
      buffer: '',
    })),
    getElementNaclFiles: jest.fn().mockImplementation(getElementNaclFiles),
    clone: jest.fn().mockImplementation(() => Promise.resolve()),
    getElementReferencedFiles: jest.fn().mockResolvedValue([]),
    load: jest.fn().mockResolvedValue({
      changes: currentElements.map(e => createAddChange(
        e, e.elemID
      )),
      cacheValid: true,
    }),
    getSearchableNames: jest.fn().mockResolvedValue(_.uniq(currentElements.flatMap(e => {
      const fieldNames = isObjectType(e)
        ? Object.values(e.fields).map(field => field.elemID.getFullName())
        : []
      return [e.elemID.getFullName(), ...fieldNames]
    }))),
  })
}
