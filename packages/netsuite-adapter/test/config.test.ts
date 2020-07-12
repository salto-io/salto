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
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { configType, getConfigFromConfigChanges } from '../src/config'
import {
  FETCH_ALL_TYPES_AT_ONCE, FILE_PATHS_REGEX_SKIP_LIST, TYPES_TO_SKIP,
} from '../src/constants'

describe('config', () => {
  const currentConfig = {
    [TYPES_TO_SKIP]: ['test1'],
    [FILE_PATHS_REGEX_SKIP_LIST]: ['^SomeRegex.*'],
  }
  const newFailedType = 'test2'
  const newFailedFilePath = '/path/to/file.js'
  const expectedNewFailedFileRegex = '^/path/to/file\\.js$'

  it('should return undefined when having no currentConfig suggestions', () => {
    expect(getConfigFromConfigChanges(false, [], [], currentConfig)).toBeUndefined()
  })

  it('should have match between generated regex and the failed file', () => {
    expect(new RegExp(expectedNewFailedFileRegex).test(newFailedFilePath)).toBe(true)
  })

  it('should not have match between generated regex and the other file paths', () => {
    expect(new RegExp(expectedNewFailedFileRegex).test('/path/to/fileajs')).toBe(false)
    expect(new RegExp(expectedNewFailedFileRegex).test('/path/to/file.js/')).toBe(false)
    expect(new RegExp(expectedNewFailedFileRegex).test('path/to/file.js')).toBe(false)
    expect(new RegExp(expectedNewFailedFileRegex).test('//path//to//file.js')).toBe(false)
  })

  it('should return updated currentConfig when having suggestions and the currentConfig is empty', () => {
    expect(getConfigFromConfigChanges(true, [newFailedType], [newFailedFilePath], {}))
      .toEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [TYPES_TO_SKIP]: [newFailedType],
          [FILE_PATHS_REGEX_SKIP_LIST]: [expectedNewFailedFileRegex],
          [FETCH_ALL_TYPES_AT_ONCE]: false,
        }
      ))
  })

  it('should return updated currentConfig when having suggestions and the currentConfig has values', () => {
    expect(getConfigFromConfigChanges(true, [newFailedType], [newFailedFilePath], currentConfig))
      .toEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [TYPES_TO_SKIP]: ['test1', newFailedType],
          [FILE_PATHS_REGEX_SKIP_LIST]: ['^SomeRegex.*', expectedNewFailedFileRegex],
          [FETCH_ALL_TYPES_AT_ONCE]: false,
        }
      ))
  })
})
