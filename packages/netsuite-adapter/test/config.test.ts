/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { configType, getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, UPDATE_FETCH_CONFIG_FORMAT, UPDATE_DEPLOY_CONFIG, combineQueryParams, fetchDefault, UPDATE_SUITEAPP_TYPES_CONFIG_FORMAT } from '../src/config'
import {
  FETCH_ALL_TYPES_AT_ONCE,
  SDF_CONCURRENCY_LIMIT,
  FETCH_TYPE_TIMEOUT_IN_MINUTES, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
  CLIENT_CONFIG, SKIP_LIST,
  TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, FETCH,
  INCLUDE, EXCLUDE, DEPLOY_REFERENCED_ELEMENTS, DEPLOY, LOCKED_ELEMENTS_TO_EXCLUDE,
} from '../src/constants'

describe('config', () => {
  const skipList: NetsuiteQueryParameters = {
    types: {
      testAll: ['.*'],
      testExistingPartial: ['scriptid1', 'scriptid2'],
    },
    filePaths: ['SomeRegex'],
  }

  const currentConfigWithSkipList = {
    [SKIP_LIST]: skipList,
    [CLIENT_CONFIG]: {
      [SDF_CONCURRENCY_LIMIT]: 2,
      [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
      [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
    },
  }
  const currentConfigWithFetch = {
    [FETCH]: {
      [INCLUDE]: fetchDefault[INCLUDE],
      [EXCLUDE]: {
        types: [
          { name: 'testAll', ids: ['.*'] },
          { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2'] },
        ],
        fileCabinet: ['SomeRegex'],
      },
    },
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
    expect(getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      currentConfigWithFetch
    )).toBeUndefined()
  })

  it('should return updated currentConfig with defined values when having suggestions and the currentConfig is empty', () => {
    const lockedFiles = ['lockedFile']
    const lockedTypes = { lockedType: ['lockedInstance'] }
    const configFromConfigChanges = getConfigFromConfigChanges(
      true,
      { lockedError: lockedFiles, otherError: [newFailedFilePath] },
      { lockedError: lockedTypes, unexpectedError: suggestedSkipListTypes },
      {}
    )?.config as InstanceElement[]
    expect(configFromConfigChanges[0].isEqual(new InstanceElement(
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

    expect(configFromConfigChanges[1].isEqual(new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        [FETCH]: {
          [LOCKED_ELEMENTS_TO_EXCLUDE]: {
            types: Object.entries(lockedTypes).map(([name, ids]) => ({ name, ids })),
            fileCabinet: lockedFiles,
          },
        },
      }
    ))).toBe(true)

    expect(configFromConfigChanges[1].path).toEqual(['lockedElements'])
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
      true,
      { lockedError: [], otherError: [newFailedFilePath] },
      { lockedError: {}, unexpectedError: suggestedSkipListTypes },
      currentConfigWithFetch,
    )
    expect(configChange?.config[0]
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: {
            [INCLUDE]: currentConfigWithFetch[FETCH][INCLUDE],
            [EXCLUDE]: newExclude,
          },
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
      [INCLUDE]: fetchDefault[INCLUDE],
      [EXCLUDE]: combineQueryParams({
        types: [
          { name: 'someType', ids: ['.*'] },
        ],
        fileCabinet: ['.*someRegex1.*', 'someRegex2.*', '.*someRegex3', 'someRegex4'],
      },
      fetchDefault[EXCLUDE]),
    }
    const config = {
      ..._.omit(currentConfigWithSkipList, SKIP_LIST),
      [TYPES_TO_SKIP]: ['someType'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['someRegex1', '^someRegex2', 'someRegex3$', '^someRegex4$'],
    }
    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      config
    )
    expect(configChange?.config[0]
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: newFetch,
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_FETCH_CONFIG_FORMAT)
  })

  it('should convert deployReferencedElements when its value is "true" to deploy', () => {
    const config = {
      ..._.omit(currentConfigWithFetch, DEPLOY_REFERENCED_ELEMENTS),
      [DEPLOY_REFERENCED_ELEMENTS]: true,
    }
    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      config
    )
    expect(configChange?.config).toHaveLength(1)
    expect(configChange?.config[0]
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: configChange?.config[0].value[FETCH],
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
          [DEPLOY]: {
            [DEPLOY_REFERENCED_ELEMENTS]: true,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_DEPLOY_CONFIG)
  })

  it('should delete deployReferencedElements when its value is "false" without adding deploy section', () => {
    const config = {
      ..._.omit(currentConfigWithFetch, DEPLOY_REFERENCED_ELEMENTS),
      [DEPLOY_REFERENCED_ELEMENTS]: false,
    }
    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      config
    )
    expect(configChange?.config?.[0].value[DEPLOY_REFERENCED_ELEMENTS]).toBe(undefined)
    expect(configChange?.config?.[0].value[DEPLOY]).toBe(undefined)
    expect(configChange?.message).toBe(UPDATE_DEPLOY_CONFIG)
  })

  it('should convert skipList to fetch', () => {
    const config = {
      ...currentConfigWithSkipList,
    }
    const newFetch = {
      [INCLUDE]: fetchDefault[INCLUDE],
      [EXCLUDE]: combineQueryParams(
        currentConfigWithFetch[FETCH][EXCLUDE],
        fetchDefault[EXCLUDE]
      ),
    }

    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      config,
    )
    expect(configChange?.config[0]
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: newFetch,
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_FETCH_CONFIG_FORMAT)
  })

  it('should combine configuration messages when needed', () => {
    const newSkipList = _.cloneDeep(skipList)
    newSkipList.types = { ...newSkipList.types, someType: ['.*'] }
    newSkipList.filePaths?.push('.*someRegex.*')
    const config = {
      ...currentConfigWithSkipList,
      [TYPES_TO_SKIP]: ['someType'],
      [FILE_PATHS_REGEX_SKIP_LIST]: ['someRegex'],
    }

    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: ['someFailedFile'] },
      { lockedError: {}, unexpectedError: {} },
      config
    )

    expect(configChange?.message).toBe(`${STOP_MANAGING_ITEMS_MSG} In addition, ${UPDATE_FETCH_CONFIG_FORMAT}`)
  })

  it('should omit skipList and update "fetch.exclude". config with skipList AND fetch', () => {
    const conf = { ...currentConfigWithFetch,
      [SKIP_LIST]: currentConfigWithSkipList[SKIP_LIST] }
    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      conf
    )
    expect(configChange?.config[0]
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          [FETCH]: {
            [INCLUDE]: fetchDefault[INCLUDE],
            [EXCLUDE]: {
              fileCabinet: ['SomeRegex'],
              types: [
                { name: 'testAll', ids: ['.*'] },
                { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2'] },
              ],
            },
          },
          [CLIENT_CONFIG]: {
            [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 15,
            [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: 10,
            [SDF_CONCURRENCY_LIMIT]: 2,
          },
        }
      ))).toBe(true)
  })

  it('should convert PascalCase typeNames to camelCase', () => {
    const conf = {
      [FETCH]: {
        [EXCLUDE]: {
          types: [{
            name: 'Subsidiary',
          }],
          fileCabinet: [],
        },
      },
    }
    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      conf,
    )
    expect(configChange?.config?.[0].value).toEqual({
      [FETCH]: {
        [EXCLUDE]: {
          types: [{
            name: 'subsidiary',
          }],
          fileCabinet: [],
        },
      },
    })
    expect(configChange?.message).toBe(UPDATE_SUITEAPP_TYPES_CONFIG_FORMAT)
  })

  describe('should have a correct default fetch config', () => {
    it('should exclude all types in a correct syntax', () => {
      expect(fetchDefault[EXCLUDE]?.types)
        .toContainEqual({
          name: 'assemblyItem|lotNumberedAssemblyItem|serializedAssemblyItem|descriptionItem|discountItem|kitItem|markupItem|nonInventoryPurchaseItem|nonInventorySaleItem|nonInventoryResaleItem|otherChargeSaleItem|otherChargeResaleItem|otherChargePurchaseItem|paymentItem|serviceResaleItem|servicePurchaseItem|serviceSaleItem|subtotalItem|inventoryItem|lotNumberedInventoryItem|serializedInventoryItem|itemGroup',
        })
    })
  })
})
