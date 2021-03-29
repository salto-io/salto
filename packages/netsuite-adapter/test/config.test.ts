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
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { NetsuiteQueryParameters } from '../src/query'
import { configType, getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, UPDATE_TO_SKIP_LIST_MSG } from '../src/config'
import {
  FETCH_ALL_TYPES_AT_ONCE, SDF_CONCURRENCY_LIMIT, DEPLOY_REFERENCED_ELEMENTS,
  FETCH_TYPE_TIMEOUT_IN_MINUTES, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
  CLIENT_CONFIG, SKIP_LIST, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST,
} from '../src/constants'

describe('config', () => {
  const skipList: NetsuiteQueryParameters = {
    types: {
      testAll: ['.*'],
      testExistingPartial: ['scriptid1', 'scriptid2'],
    },
    filePaths: ['SomeRegex'],
  }
  const currentConfig = {
    [SKIP_LIST]: skipList,
    [DEPLOY_REFERENCED_ELEMENTS]: false,
    [CLIENT_CONFIG]: {
      [SDF_CONCURRENCY_LIMIT]: 2,
      [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
      [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
    },
  }
  const newFailedFilePath = '/path/to/file'
  const suggestedSkipListTypes = {
    testExistingPartial: ['scriptid3', 'scriptid4'],
    testNew: ['scriptid5', 'scriptid6'],
  }

  it('should return undefined when having no currentConfig suggestions', () => {
    expect(getConfigFromConfigChanges(false, [], {}, currentConfig)).toBeUndefined()
  })

  it('should return updated currentConfig with defined values when having suggestions and the currentConfig is empty', () => {
    const configFromConfigChanges = getConfigFromConfigChanges(true,
      [newFailedFilePath], suggestedSkipListTypes, {})?.config as InstanceElement
    expect(configFromConfigChanges.isEqual(new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        [SKIP_LIST]: {
          filePaths: [_.escapeRegExp(newFailedFilePath)],
          types: suggestedSkipListTypes,
        },
        [CLIENT_CONFIG]: {
          [FETCH_ALL_TYPES_AT_ONCE]: false,
        },
      }
    ))).toBe(true)
  })

  it('should return updated currentConfig when having suggestions and the currentConfig has values', () => {
    const newSkipList = _.cloneDeep(skipList)
    newSkipList.filePaths.push(_.escapeRegExp(newFailedFilePath))
    newSkipList.types.testExistingPartial.push('scriptid3', 'scriptid4')
    newSkipList.types.testNew = ['scriptid5', 'scriptid6']

    const configChange = getConfigFromConfigChanges(
      true, [newFailedFilePath], suggestedSkipListTypes, currentConfig
    )
    expect(configChange?.config)
      .toEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [SKIP_LIST]: newSkipList,
          [DEPLOY_REFERENCED_ELEMENTS]: false,
          [CLIENT_CONFIG]: {
            [FETCH_ALL_TYPES_AT_ONCE]: false,
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))

    expect(configChange?.message).toBe(STOP_MANAGING_ITEMS_MSG)
  })

  it('should convert typesToSkip and filePathsRegexSkipList to skipList', () => {
    const newSkipList = {
      types: {
        someType: ['.*'],
      },
      filePaths: ['.*someRegex1.*', 'someRegex2.*', '.*someRegex3', 'someRegex4'],
    }
    const config = {
      ..._.omit(currentConfig, SKIP_LIST),
      [TYPES_TO_SKIP]: ['someType'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['someRegex1', '^someRegex2', 'someRegex3$', '^someRegex4$'],
    }

    const configChange = getConfigFromConfigChanges(false, [], {}, config)
    expect(configChange?.config)
      .toEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [SKIP_LIST]: newSkipList,
          [DEPLOY_REFERENCED_ELEMENTS]: false,
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))

    expect(configChange?.message).toBe(UPDATE_TO_SKIP_LIST_MSG)
  })

  it('should combine configuration messages when needed', () => {
    const newSkipList = _.cloneDeep(skipList)
    newSkipList.types.someType = ['.*']
    newSkipList.filePaths.push('.*someRegex.*')
    const config = {
      ...currentConfig,
      [TYPES_TO_SKIP]: ['someType'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['someRegex'],
    }

    const configChange = getConfigFromConfigChanges(false, ['someFailedFile'], {}, config)

    expect(configChange?.message).toBe(`${STOP_MANAGING_ITEMS_MSG} In addition, ${UPDATE_TO_SKIP_LIST_MSG}`)
  })
})
