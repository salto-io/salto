/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, Element } from '@salto-io/adapter-api'
import _ from 'lodash'
import path from 'path'
import { BlueprintsSource } from '../../src/workspace/blueprints/blueprints_source'
import { Errors } from '../../src/workspace/errors'
import { SourceRange } from '../../src/parser/internal/types'

export const createMockBlueprintSource = (
  elements: Element[],
  blueprints: Record<string, Element[]> = {},
  errors: Errors = new Errors({ merge: [], parse: [], validation: [] }),
  sourceRanges: SourceRange[] = []
): BlueprintsSource => ({
  list: async () => elements.map(e => e.elemID),
  get: async (id: ElemID) => elements.find(e => _.isEqual(id, e.elemID)),
  getAll: async () => elements,
  flush: jest.fn().mockImplementation(() => Promise.resolve()),
  updateBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  listBlueprints: jest.fn().mockImplementation(() => Promise.resolve(_.keys(blueprints))),
  getBlueprint: jest.fn().mockImplementation(
    (filename: string) => Promise.resolve(blueprints[filename] ? { filename, buffer: '' } : undefined)
  ),
  setBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  removeBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  getSourceMap: jest.fn().mockImplementation(() => Promise.resolve()),
  getSourceRanges: jest.fn().mockImplementation(() => Promise.resolve(sourceRanges)),
  getErrors: jest.fn().mockImplementation(() => Promise.resolve(errors)),
  getElements: jest.fn().mockImplementation(
    filename => Promise.resolve(blueprints[filename] || [])
  ),
  getElementBlueprints: jest.fn().mockImplementation(() => Promise.resolve([path.join('test', 'path.bp')])),
  clone: jest.fn().mockImplementation(() => Promise.resolve()),
})
