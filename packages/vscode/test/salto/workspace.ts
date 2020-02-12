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
import * as path from 'path'
import { Config, Workspace, parse, file, SourceRange } from '@salto-io/core'
import { InstanceElement, ElemID, ObjectType, Field, BuiltinTypes } from '@salto-io/adapter-api'
import _ from 'lodash'
import { ParseError } from '@salto-io/core/dist/src/parser/parse'
import { mergeElements } from '@salto-io/core/dist/src/core/merger'

const SERVICES = ['salesforce']

const configID = new ElemID(SERVICES[0])
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
  },
})
const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
})
export const mockWorkspace = async (blueprint?: string, config?: Partial<Config>
): Promise<Workspace> => {
  const baseDir = blueprint ? path.dirname(blueprint) : 'default_base_dir'
  const filename = blueprint ? path.relative(baseDir, blueprint) : 'default.bp'
  const buffer = blueprint ? await file.readTextFile(blueprint) : 'blabla'
  const parseResult = blueprint
    ? parse(Buffer.from(buffer), filename)
    : { elements: [], errors: [] as ParseError[], sourceMap: { get: () => undefined } }
  const merged = mergeElements(parseResult.elements)
  return {
    elements: merged.merged,
    errors: {
      parse: parseResult.errors || [],
      merge: [],
      validation: [],
      hasErrors: () => (!_.isEmpty(parseResult.errors)),
    },
    hasErrors: jest.fn().mockImplementation(() => !_.isEmpty(parseResult.errors)),
    getSourceMap: jest.fn().mockResolvedValue(parseResult.sourceMap),
    getSourceRanges: jest.fn().mockImplementation((elemID: ElemID): SourceRange[] =>
      (parseResult.sourceMap.get(elemID.getFullName()) || [])),
    getBlueprint: jest.fn().mockResolvedValue({ filename, buffer }),
    config: _.mergeWith(config, { stateLocation: '.', services: SERVICES, baseDir }),
    updateBlueprints: jest.fn(),
    flush: jest.fn(),
    credentials: {
      get: jest.fn().mockImplementation(() => Promise.resolve(mockConfigInstance)),
      set: jest.fn().mockImplementation(() => Promise.resolve()),
    },
    getWorkspaceErrors: jest.fn().mockImplementation(() => parseResult.errors.map(e => e && {
      sourceFragments: [{ sourceRange: { filename, start: 1, end: 2 } }],
    })),
    setBlueprints: jest.fn().mockReturnValue(Promise.resolve()),
    removeBlueprints: jest.fn().mockReturnValue(Promise.resolve()),
    blueprintsStore: {
      list: jest.fn().mockResolvedValue([filename]),
    },
    listBlueprints: jest.fn().mockResolvedValue([filename]),
  } as unknown as Workspace
}
