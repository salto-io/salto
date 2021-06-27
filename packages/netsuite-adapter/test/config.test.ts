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
import { configType, getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, UPDATE_CONFIG_FORMAT } from '../src/config'
import {
  FETCH_ALL_TYPES_AT_ONCE,
  SDF_CONCURRENCY_LIMIT, DEPLOY_REFERENCED_ELEMENTS,
  FETCH_TYPE_TIMEOUT_IN_MINUTES, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
  CLIENT_CONFIG, SKIP_LIST,
  TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, FETCH, INCLUDE, EXCLUDE, SAVED_SEARCH,
} from '../src/constants'

describe('config', () => {
  const skipList: NetsuiteQueryParameters = {
    types: {
      testAll: ['.*'],
      testExistingPartial: ['scriptid1', 'scriptid2'],
    },
    filePaths: ['SomeRegex'],
  }
  const defaultFetch = {
    [INCLUDE]: {
      types: [{
        name: '.*',
      }],
      fileCabinet: [
        '^/SuiteScripts/.*',
        '^/Templates/.*',
        '^/Web Site Hosting Files/.*',
        '^/SuiteBundles/.*',
      ],
    },
    [EXCLUDE]: {
      types: [{
        name: SAVED_SEARCH,
      }],
      fileCabinet: [],
    },
  }
  const currentConfigWithSkipList = {
    [SKIP_LIST]: skipList,
    [DEPLOY_REFERENCED_ELEMENTS]: false,
    [CLIENT_CONFIG]: {
      [SDF_CONCURRENCY_LIMIT]: 2,
      [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
      [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
    },
  }
  const currentConfigWithFetch = {
    [FETCH]: {
      [INCLUDE]: defaultFetch[INCLUDE],
      [EXCLUDE]: {
        types: [
          { name: 'testAll', ids: ['.*'] },
          { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2'] },
        ],
        fileCabinet: ['SomeRegex'],
      },
    },
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
    expect(getConfigFromConfigChanges(false, [], {}, currentConfigWithFetch)).toBeUndefined()
  })

  it('should return updated currentConfig with defined values when having suggestions and the currentConfig is empty', () => {
    const configFromConfigChanges = getConfigFromConfigChanges(true,
      [newFailedFilePath], suggestedSkipListTypes, {})?.config as InstanceElement
    expect(configFromConfigChanges.isEqual(new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        [FETCH]: {
          [EXCLUDE]: {
            types: Object.entries(suggestedSkipListTypes).map(([name, ids]) => ({ name, ids })),
            fileCabinet: [newFailedFilePath],
          },
        },
        [CLIENT_CONFIG]: {
          [FETCH_ALL_TYPES_AT_ONCE]: false,
        },
      }
    ))).toBe(true)
  })

  it('should return updated currentConfig when having suggestions and the currentConfig has values', () => {
    const newExclude = {
      types: [
        { name: 'testAll', ids: ['.*'] },
        { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2', 'scriptid3', 'scriptid4'] },
        { name: 'testNew', ids: ['scriptid5', 'scriptid6'] },
      ],
      fileCabinet: ['SomeRegex'],
    }
    newExclude.fileCabinet.push(_.escapeRegExp(newFailedFilePath))
    const configChange = getConfigFromConfigChanges(
      true, [newFailedFilePath], suggestedSkipListTypes, currentConfigWithFetch
    )
    expect(configChange?.config
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: {
            [INCLUDE]: currentConfigWithFetch[FETCH][INCLUDE],
            [EXCLUDE]: newExclude,
          },
          [DEPLOY_REFERENCED_ELEMENTS]: false,
          [CLIENT_CONFIG]: {
            [FETCH_ALL_TYPES_AT_ONCE]: false,
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(STOP_MANAGING_ITEMS_MSG)
  })

  it('should convert typesToSkip and filePathsRegexSkipList to fetch', () => {
    const newFetch = {
      [INCLUDE]: defaultFetch[INCLUDE],
      [EXCLUDE]: {
        types: [
          { name: 'someType', ids: ['.*'] },
        ],
        fileCabinet: ['.*someRegex1.*', 'someRegex2.*', '.*someRegex3', 'someRegex4'],
      },
    }
    const config = {
      ..._.omit(currentConfigWithSkipList, SKIP_LIST),
      [TYPES_TO_SKIP]: ['someType'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['someRegex1', '^someRegex2', 'someRegex3$', '^someRegex4$'],
    }
    const configChange = getConfigFromConfigChanges(false, [], {}, config)
    expect(configChange?.config
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: newFetch,
          [DEPLOY_REFERENCED_ELEMENTS]: false,
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_CONFIG_FORMAT)
  })

  it('should convert skipList to fetch', () => {
    const config = {
      ...currentConfigWithSkipList,
    }
    const newFetch = {
      [INCLUDE]: defaultFetch[INCLUDE],
      [EXCLUDE]: currentConfigWithFetch[FETCH][EXCLUDE],
    }

    const configChange = getConfigFromConfigChanges(false, [], {}, config)
    expect(configChange?.config
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: newFetch,
          [DEPLOY_REFERENCED_ELEMENTS]: false,
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_CONFIG_FORMAT)
  })

  it('should combine configuration messages when needed', () => {
    const newSkipList = _.cloneDeep(skipList)
    newSkipList.types.someType = ['.*']
    newSkipList.filePaths.push('.*someRegex.*')
    const config = {
      ...currentConfigWithSkipList,
      [TYPES_TO_SKIP]: ['someType'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['someRegex'],
    }

    const configChange = getConfigFromConfigChanges(false, ['someFailedFile'], {}, config)

    expect(configChange?.message).toBe(`${STOP_MANAGING_ITEMS_MSG} In addition, ${UPDATE_CONFIG_FORMAT}`)
  })

  it('should omit skipList and update "fetch.exclude". config with skipList AND fetch', () => {
    const conf = { ...currentConfigWithFetch,
      [SKIP_LIST]: currentConfigWithSkipList[SKIP_LIST] }
    const configChange = getConfigFromConfigChanges(false, [], {}, conf)
    expect(configChange?.config
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: {
            [INCLUDE]: defaultFetch[INCLUDE],
            [EXCLUDE]: {
              fileCabinet: ['SomeRegex'],
              types: [
                { name: 'testAll', ids: ['.*'] },
                { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2'] },
              ],
            },
          },
          [DEPLOY_REFERENCED_ELEMENTS]: false,
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)
  })
})
