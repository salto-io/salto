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
import { configType, getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, UPDATE_FETCH_CONFIG_FORMAT, UPDATE_DEPLOY_CONFIG, combineQueryParams, fetchDefault, UPDATE_SUITEAPP_TYPES_CONFIG_FORMAT, CONFIG } from '../src/config'

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

    expect(configChange?.message).toBe(STOP_MANAGING_ITEMS_MSG)
  })

  it('should convert typesToSkip and filePathsRegexSkipList to fetch', () => {
    const newFetch = {
      include: fetchDefault.include,
      exclude: combineQueryParams({
        types: [
          { name: 'someType', ids: ['.*'] },
        ],
        fileCabinet: ['.*someRegex1.*', 'someRegex2.*', '.*someRegex3', 'someRegex4'],
      },
      fetchDefault.exclude),
    }
    const config = {
      ..._.omit(currentConfigWithSkipList, CONFIG.skipList),
      typesToSkip: ['someType'],
      filePathRegexSkipList: ['someRegex1', '^someRegex2', 'someRegex3$', '^someRegex4$'],
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
          fetch: newFetch,
          client: {
            fetchTypeTimeoutInMinutes: 15,
            maxItemsInImportObjectsRequest: 10,
            sdfConcurrencyLimit: 2,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_FETCH_CONFIG_FORMAT)
  })

  it('should convert deployReferencedElements when its value is "true" to deploy', () => {
    const config = {
      ..._.omit(currentConfigWithFetch, CONFIG.deployReferencedElements),
      deployReferencedElements: true,
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
          fetch: configChange?.config[0].value.fetch,
          client: {
            fetchTypeTimeoutInMinutes: 15,
            maxItemsInImportObjectsRequest: 10,
            sdfConcurrencyLimit: 2,
          },
          deploy: {
            deployReferencedElements: true,
          },
        }
      ))).toBe(true)

    expect(configChange?.message).toBe(UPDATE_DEPLOY_CONFIG)
  })

  it('should delete deployReferencedElements when its value is "false" without adding deploy section', () => {
    const config = {
      ..._.omit(currentConfigWithFetch, CONFIG.deployReferencedElements),
      deployReferencedElements: false,
    }
    const configChange = getConfigFromConfigChanges(
      false,
      { lockedError: [], otherError: [] },
      { lockedError: {}, unexpectedError: {} },
      config
    )
    expect(configChange?.config?.[0].value.deployReferencedElements).toBe(undefined)
    expect(configChange?.config?.[0].value.deploy).toBe(undefined)
    expect(configChange?.message).toBe(UPDATE_DEPLOY_CONFIG)
  })

  it('should convert skipList to fetch', () => {
    const config = {
      ...currentConfigWithSkipList,
    }
    const newFetch = {
      include: fetchDefault.include,
      exclude: combineQueryParams(
        currentConfigWithFetch.fetch.exclude,
        fetchDefault.exclude
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
          fetch: newFetch,
          client: {
            fetchTypeTimeoutInMinutes: 15,
            maxItemsInImportObjectsRequest: 10,
            sdfConcurrencyLimit: 2,
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
      typesToSkip: ['someType'],
      filePathRegexSkipList: ['someRegex'],
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
      skipList: currentConfigWithSkipList.skipList }
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
          fetch: {
            include: fetchDefault.include,
            exclude: {
              fileCabinet: ['SomeRegex'],
              types: [
                { name: 'testAll', ids: ['.*'] },
                { name: 'testExistingPartial', ids: ['scriptid1', 'scriptid2'] },
              ],
            },
          },
          client: {
            fetchTypeTimeoutInMinutes: 15,
            maxItemsInImportObjectsRequest: 10,
            sdfConcurrencyLimit: 2,
          },
        }
      ))).toBe(true)
  })

  it('should convert PascalCase typeNames to camelCase', () => {
    const conf = {
      fetch: {
        exclude: {
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
      fetch: {
        exclude: {
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
      expect(fetchDefault.exclude?.types)
        .toContainEqual({
          name: 'assemblyItem|lotNumberedAssemblyItem|serializedAssemblyItem|descriptionItem|discountItem|kitItem|markupItem|nonInventoryPurchaseItem|nonInventorySaleItem|nonInventoryResaleItem|otherChargeSaleItem|otherChargeResaleItem|otherChargePurchaseItem|paymentItem|serviceResaleItem|servicePurchaseItem|serviceSaleItem|subtotalItem|inventoryItem|lotNumberedInventoryItem|serializedInventoryItem|itemGroup',
        })
    })
  })
})
