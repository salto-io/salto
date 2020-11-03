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
import { readFileSync } from 'fs'
import _ from 'lodash'
import { Workspace, parser, errors as wsErrors,
  merger, configSource as cs } from '@salto-io/workspace'
import { ElemID, ObjectType, BuiltinTypes, InstanceElement, SaltoError } from '@salto-io/adapter-api'

const { parse } = parser
const { mergeElements } = merger
const SERVICES = ['salesforce']

const configID = new ElemID(SERVICES[0])
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: { username: { type: BuiltinTypes.STRING } },
})
const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
})

export const mockErrors = (
  errors: SaltoError[], parseErrors: parser.ParseError[] = []
): wsErrors.Errors => ({
  all: () => [...errors, ...parseErrors],
  hasErrors: () => errors.length !== 0,
  merge: [],
  parse: parseErrors,
  validation: errors.map(err => ({ elemID: new ElemID('test'), error: '', ...err })),
  strings: () => errors.map(err => err.message),
})

export const mockFunction = <T extends (...args: never[]) => unknown>():
jest.Mock<ReturnType<T>, Parameters<T>> => jest.fn()

const buildMockWorkspace = async (
  naclFile?: string,
  buffer?: string,
): Promise<Workspace> => {
  const baseDir = naclFile ? path.dirname(naclFile) : 'default_base_dir'
  const filename = naclFile ? path.relative(baseDir, naclFile) : 'default.nacl'
  let parseResult: Required<parser.ParseResult>
  if (buffer) {
    parseResult = await parse(Buffer.from(buffer), filename, {})
  } else {
    parseResult = {
      elements: [], errors: [] as parser.ParseError[], sourceMap: new parser.SourceMap(),
    }
  }
  const merged = mergeElements(parseResult.elements)
  return {
    elements: () => Promise.resolve(merged.merged),
    errors: () => Promise.resolve({
      all: () => parseResult.errors || [],
      strings: () => (parseResult.errors || []).map(err => err.message),
      parse: parseResult.errors || [],
      merge: [],
      validation: [],
      hasErrors: () => (!_.isEmpty(parseResult.errors)),
    }),
    hasErrors: mockFunction<Workspace['hasErrors']>().mockResolvedValue(!_.isEmpty(parseResult.errors)),
    getSourceMap: mockFunction<Workspace['getSourceMap']>().mockResolvedValue(parseResult.sourceMap),
    getSourceRanges: mockFunction<Workspace['getSourceRanges']>().mockImplementation(async elemID =>
      (parseResult.sourceMap.get(elemID.getFullName()) || [])),
    getNaclFile: mockFunction<Workspace['getNaclFile']>().mockResolvedValue({ filename, buffer: buffer ?? '' }),
    services: () => SERVICES,
    updateNaclFiles: mockFunction<Workspace['updateNaclFiles']>(),
    flush: mockFunction<Workspace['flush']>(),
    credentials: {
      get: mockFunction<cs.ConfigSource['get']>().mockResolvedValue(mockConfigInstance),
      set: mockFunction<cs.ConfigSource['set']>().mockResolvedValue(),
    },
    transformError: mockFunction<Workspace['transformError']>().mockImplementation(async err => ({
      ...err,
      sourceFragments: [{
        fragment: '',
        sourceRange: {
          start: { line: 1, col: 1, byte: 1 },
          end: { line: 1, col: 2, byte: 2 },
          filename: 'test.nacl',
        },
      }],
    })),
    setNaclFiles: mockFunction<Workspace['setNaclFiles']>().mockResolvedValue(),
    removeNaclFiles: mockFunction<Workspace['removeNaclFiles']>().mockResolvedValue(),
    listNaclFiles: mockFunction<Workspace['listNaclFiles']>().mockResolvedValue([filename]),
    getParsedNaclFile: mockFunction<Workspace['getParsedNaclFile']>().mockResolvedValue({
      elements: merged.merged,
      filename: '',
      timestamp: Date.now(),
      errors: [],
      referenced: [],
    }),
    getElementReferencedFiles: mockFunction<Workspace['getElementReferencedFiles']>().mockResolvedValue([filename]),
    clone: mockFunction<Workspace['clone']>().mockImplementation(() => Promise.resolve(buildMockWorkspace(naclFile, buffer))),
  } as unknown as Workspace
}

export const mockWorkspace = async (naclFile?: string): Promise<Workspace> => {
  const buffer = naclFile ? readFileSync(naclFile, { encoding: 'utf8' }) : 'blabla'
  return buildMockWorkspace(naclFile, buffer)
}
