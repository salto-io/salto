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
import { configType, getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, fetchDefault, LARGE_FOLDERS_EXCLUDED_MESSAGE, instanceLimiterCreator, UNLIMITED_INSTANCES_VALUE, LARGE_TYPES_EXCLUDED_MESSAGE, validateClientConfig, DEFAULT_MAX_INSTANCES_VALUE } from '../src/config'

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
      {
        failedToFetchAllAtOnce: false,
        failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
        failedCustomRecords: [],
      },
      currentConfigWithFetch
    )).toBeUndefined()
  })

  it('should return updated currentConfig with defined values when having suggestions and the currentConfig is empty', () => {
    const lockedFiles = ['lockedFile']
    const lockedTypes = { lockedType: ['lockedInstance'] }
    const configFromConfigChanges = getConfigFromConfigChanges(
      {
        failedToFetchAllAtOnce: true,
        failedFilePaths: { lockedError: lockedFiles, otherError: [newFailedFilePath], largeFolderError: [] },
        failedTypes: { lockedError: lockedTypes, unexpectedError: suggestedSkipListTypes, excludedTypes: [] },
        failedCustomRecords: [],
      },
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
        { name: 'excludedTypeTest' },
      ],
      fileCabinet: ['SomeRegex', _.escapeRegExp(newFailedFilePath), newLargeFolderExclusion],
      customRecords: [
        { name: 'excludedCustomRecord' },
      ],
    }
    const configChange = getConfigFromConfigChanges(
      {
        failedToFetchAllAtOnce: true,
        failedFilePaths: { lockedError: [], otherError: [newFailedFilePath], largeFolderError: [newLargeFolderPath] },
        failedTypes: { lockedError: {}, unexpectedError: suggestedSkipListTypes, excludedTypes: ['excludedTypeTest'] },
        failedCustomRecords: ['excludedCustomRecord'],
      },
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

    expect(configChange?.message).toBe(formatConfigSuggestionsReasons([
      STOP_MANAGING_ITEMS_MSG, LARGE_FOLDERS_EXCLUDED_MESSAGE, LARGE_TYPES_EXCLUDED_MESSAGE,
    ]))
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
      {
        failedToFetchAllAtOnce: false,
        failedFilePaths: { lockedError: [], otherError: [newFailedFilePath], largeFolderError: [newLargeFolderPath] },
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
        failedCustomRecords: [],
      },
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

  describe('instanceLimiter', () => {
    const overDefault = DEFAULT_MAX_INSTANCES_VALUE + 1
    const underDefault = DEFAULT_MAX_INSTANCES_VALUE - 1
    describe('with maxInstancesPerType in the config', () => {
      const limiter = instanceLimiterCreator({ maxInstancesPerType: [
        { name: 'customsegment', limit: 30 },
        { name: 'unlimited', limit: UNLIMITED_INSTANCES_VALUE },
        { name: 'savedsearch', limit: 50_000 },
      ] })

      it('should limit according to type if exists', () => {
        expect(limiter('customsegment', 31)).toBeTruthy()
        expect(limiter('customsegment', 29)).toBeFalsy()
      })
      it('should limit according to default if type does not exist', () => {
        expect(limiter('test', overDefault)).toBeTruthy()
        expect(limiter('test', underDefault)).toBeFalsy()
      })
      it('should not limit at all if the type is unlimited', () => {
        expect(limiter('unlimited', 100_000_000)).toBeFalsy()
      })
      it('should limit to the highest match if multiple exist (also from default definition)', () => {
        expect(limiter('savedsearch', 30_000)).toBeFalsy()
        expect(limiter('savedsearch', 60_000)).toBeTruthy()
      })
    })
    describe('without maxInstancesPerType in the config', () => {
      const limiter = instanceLimiterCreator({})

      it('should limit according to type if exists', () => {
        expect(limiter('customrecord_type', 10_001)).toBeTruthy()
        expect(limiter('customrecord_type', 9999)).toBeFalsy()
      })
      it('should limit according to default if type does not exist', () => {
        expect(limiter('test', overDefault)).toBeTruthy()
        expect(limiter('test', underDefault)).toBeFalsy()
      })
    })

    it('should limit according to default if no parameter is given', () => {
      const limiter = instanceLimiterCreator()
      expect(limiter('test', overDefault)).toBeTruthy()
      expect(limiter('test', underDefault)).toBeFalsy()
    })

    it('should limit according to the largest matching limit', () => {
      const limiter = instanceLimiterCreator({ maxInstancesPerType: [
        { name: 'customsegment', limit: 500 },
        { name: 'custom.*', limit: 400 },
        { name: '.*', limit: 300 },
      ] })
      expect(limiter('customsegment', 499)).toBeFalsy()
      expect(limiter('customsegment', 501)).toBeTruthy()

      expect(limiter('customlist', 399)).toBeFalsy()
      expect(limiter('customlist', 401)).toBeTruthy()

      expect(limiter('test', 299)).toBeFalsy()
      expect(limiter('test', 301)).toBeTruthy()
    })
  })

  describe('validateClientConfig', () => {
    describe('validateMaxInstancesPerType', () => {
      it('should validate maxInstancesPerType is the correct object with valid NS types', () => {
        const config = {
          maxInstancesPerType: [{ name: 'customsegment', limit: 3 }],
        }
        expect(() => validateClientConfig(config, false)).not.toThrow()
      })

      it('should validate also customrecordtype instances', () => {
        const config = {
          maxInstancesPerType: [{ name: 'customrecord_ForTesting', limit: 3 }],
        }
        expect(() => validateClientConfig(config, false)).not.toThrow()
      })

      it('should throw if maxInstancesPerType is the wrong object', () => {
        const config = {
          maxInstancesPerType: [{ wrong_name: 'customsegment', limit: 3 }],
        }
        expect(() => validateClientConfig(config, false)).toThrow()
      })

      it('should throw if maxInstancesPerType is the correct object with invalid NS types', () => {
        const config = {
          maxInstancesPerType: [{ name: 'not_supported_type', limit: 3 }],
        }
        expect(() => validateClientConfig(config, false)).toThrow()
      })
    })
  })
})
