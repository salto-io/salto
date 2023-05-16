/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { formatConfigSuggestionsReasons } from '@salto-io/adapter-utils'
import { NetsuiteQueryParameters } from '../src/query'
import { configType, getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, fetchDefault, LARGE_FOLDERS_EXCLUDED_MESSAGE } from '../src/config'

describe('config', () => {
  const skipList: NetsuiteQueryParameters = {
    types: {
      testAll: ['.*'],
      testExistingPartial: ['scriptid1', 'scriptid2'],
    },
    filePaths: ['SomeRegex'],
  }

  const currentConfigWithSkipList = {
    skipList,
    client: {
      sdfConcurrencyLimit: 2,
      fetchTypeTimeoutInMinutes: 15,
      maxItemsInImportObjectsRequest: 10,
    },
  }
  const currentConfigWithFetch = {
    fetch: {
      include: fetchDefault.include,
      exclude: {
        types: [
          { name: 'testAll', ids: ['.*'] },
          { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2'] },
        ],
        fileCabinet: ['SomeRegex'],
      },
    },
    client: {
      sdfConcurrencyLimit: 2,
      fetchTypeTimeoutInMinutes: 15,
      maxItemsInImportObjectsRequest: 10,
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
      { lockedError: [], otherError: [], largeFolderError: [] },
      { lockedError: {}, unexpectedError: {} },
      currentConfigWithFetch
    )).toBeUndefined()
  })

  it('should return updated currentConfig with defined values when having suggestions and the currentConfig is empty', () => {
    const lockedFiles = ['lockedFile']
    const lockedTypes = { lockedType: ['lockedInstance'] }
    const configFromConfigChanges = getConfigFromConfigChanges(
      true,
      { lockedError: lockedFiles, otherError: [newFailedFilePath], largeFolderError: [] },
      { lockedError: lockedTypes, unexpectedError: suggestedSkipListTypes },
      {}
    )?.config as InstanceElement[]
    expect(configFromConfigChanges[0].isEqual(new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        fetch: {
          exclude: {
            types: Object.entries(suggestedSkipListTypes).map(([name, ids]) => ({ name, ids })),
            fileCabinet: [newFailedFilePath],
          },
        },
        client: {
          fetchAllTypesAtOnce: false,
        },
      }
    ))).toBe(true)

    expect(configFromConfigChanges[1].isEqual(new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        fetch: {
          lockedElementsToExclude: {
            types: Object.entries(lockedTypes).map(([name, ids]) => ({ name, ids })),
            fileCabinet: lockedFiles,
          },
        },
      }
    ))).toBe(true)

    expect(configFromConfigChanges[1].path).toEqual(['lockedElements'])
  })

  it('should return updated currentConfig when having suggestions and the currentConfig has values', () => {
    const newLargeFolderPath = '/largeFolder/'
    const newLargeFolderExclusion = `^${newLargeFolderPath}.*`
    const newExclude = {
      types: [
        { name: 'testAll', ids: ['.*'] },
        { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2', 'scriptid3', 'scriptid4'] },
        { name: 'testNew', ids: ['scriptid5', 'scriptid6'] },
      ],
      fileCabinet: ['SomeRegex', _.escapeRegExp(newFailedFilePath), newLargeFolderExclusion],
      customRecords: [],
    }
    const configChange = getConfigFromConfigChanges(
      true,
      { lockedError: [], otherError: [newFailedFilePath], largeFolderError: [newLargeFolderPath] },
      { lockedError: {}, unexpectedError: suggestedSkipListTypes },
      currentConfigWithFetch,
    )
    expect(configChange?.config[0]
      .isEqual(new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        {
          fetch: {
            include: currentConfigWithFetch.fetch.include,
            exclude: newExclude,
          },
          client: {
            fetchAllTypesAtOnce: false,
            fetchTypeTimeoutInMinutes: 15,
            maxItemsInImportObjectsRequest: 10,
            sdfConcurrencyLimit: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message)
      .toBe(formatConfigSuggestionsReasons([STOP_MANAGING_ITEMS_MSG, LARGE_FOLDERS_EXCLUDED_MESSAGE]))
  })

  it('should combine configuration messages when needed', () => {
    const newLargeFolderPath = '/largeFolder/'
    const newLargeFolderExclusion = `^${newLargeFolderPath}.*`
    const newSkipList = _.cloneDeep(skipList)
    newSkipList.types = { ...newSkipList.types, someType: ['.*'] }
    newSkipList.filePaths?.push('.*someRegex.*')
    const config = {
      ...currentConfigWithSkipList,
      typesToSkip: ['someType'],
      filePathRegexSkipList: ['someRegex'],
      fileCabinet: ['SomeRegex', _.escapeRegExp(newFailedFilePath), newLargeFolderExclusion],
    }

    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [newFailedFilePath], largeFolderError: [newLargeFolderPath] },
      { lockedError: {}, unexpectedError: {} },
      config
    )

    expect(configChange?.message)
      .toBe(formatConfigSuggestionsReasons([STOP_MANAGING_ITEMS_MSG, LARGE_FOLDERS_EXCLUDED_MESSAGE]))
  })

  describe('should have a correct default fetch config', () => {
    it('should exclude all types in a correct syntax', () => {
      expect(fetchDefault.exclude?.types)
        .toContainEqual({
          name: 'assemblyItem|lotNumberedAssemblyItem|serializedAssemblyItem|descriptionItem|discountItem|kitItem|markupItem|nonInventoryPurchaseItem|nonInventorySaleItem|nonInventoryResaleItem|otherChargeSaleItem|otherChargeResaleItem|otherChargePurchaseItem|paymentItem|serviceResaleItem|servicePurchaseItem|serviceSaleItem|subtotalItem|inventoryItem|lotNumberedInventoryItem|serializedInventoryItem|itemGroup',
        })
    })
  })
})
