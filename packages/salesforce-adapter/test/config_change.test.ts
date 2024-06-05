/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { formatConfigSuggestionsReasons } from '@salto-io/adapter-utils'
import {
  ConfigChangeSuggestion,
  SalesforceConfig,
  MAX_ITEMS_IN_RETRIEVE_REQUEST,
} from '../src/types'
import { getConfigFromConfigChanges, ConfigChange } from '../src/config_change'
import { MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST } from '../src/constants'

describe('Config Changes', () => {
  const includedObjectName = '.*Object.*'
  const refToObjectName = '.*refTo.*'
  const currentConfig: SalesforceConfig = {
    deploy: {},
    fetch: {
      metadata: {
        exclude: [{ metadataType: 'Type1' }],
        objectsToSeperateFieldsToFiles: ['Type2'],
      },
      data: {
        includeObjects: [includedObjectName],
        excludeObjects: [],
        allowReferenceTo: [refToObjectName],
        saltoIDSettings: {
          defaultIdFields: ['Name'],
        },
      },
      fetchAllCustomSettings: true,
    },
  }
  const cloneOfCurrentConfig = { ...currentConfig }

  it('should return undefined if no suggested changes', () => {
    const suggestedInstance = getConfigFromConfigChanges(
      [],
      cloneOfCurrentConfig,
    )
    expect(suggestedInstance).toBeUndefined()
    expect(cloneOfCurrentConfig).toEqual(currentConfig)
  })

  describe('getConfigFromConfigChanges - dataManagement suggestions', () => {
    describe('when suggestion is about an object that appears in includeObjects', () => {
      let newConfig: ConfigChange | undefined
      beforeAll(() => {
        const suggestToRemoveObject = {
          type: 'dataObjectsExclude',
          value: includedObjectName,
        } as ConfigChangeSuggestion
        newConfig = getConfigFromConfigChanges(
          [suggestToRemoveObject],
          cloneOfCurrentConfig,
        )
      })

      it('should create one config instance', () => {
        expect(newConfig?.config).toHaveLength(1)
      })

      it('should create an instance with values same as original config besides excludeObjects', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.config?.[0].value.deploy).toEqual({})
        expect(newConfig?.config?.[0].value.fetch.metadata).toEqual(
          currentConfig.fetch?.metadata,
        )

        const currentConfigClone = _.cloneDeep(currentConfig)
        delete currentConfigClone.fetch?.data?.excludeObjects

        expect(newConfig?.config?.[0].value.fetch.data).toMatchObject(
          currentConfigClone.fetch?.data ?? {},
        )
      })

      it('should add the object name to excludeObjects', () => {
        expect(
          newConfig?.config?.[0].value.fetch.data.excludeObjects,
        ).toContain(includedObjectName)
      })

      it('should not change the currentConfig', () => {
        expect(cloneOfCurrentConfig).toEqual(currentConfig)
      })

      it("should return only the general message since the change doesn't have explicit reason", () => {
        expect(newConfig?.message).toEqual(
          formatConfigSuggestionsReasons([
            'Salto failed to fetch some items from Salesforce. Failed items must be excluded from the fetch.',
          ]),
        )
      })
    })

    describe('when suggestion is about an object that appears in allowReferenceTo', () => {
      let newConfig: InstanceElement[] | undefined
      beforeAll(() => {
        const suggestToRemoveObject = {
          type: 'dataObjectsExclude',
          value: refToObjectName,
        } as ConfigChangeSuggestion
        newConfig = getConfigFromConfigChanges(
          [suggestToRemoveObject],
          currentConfig,
        )?.config
      })

      it('should create an instance with values same as original config besides excludeObjects and allowReferenceTo', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.[0].value.fetch.metadata).toEqual(
          currentConfig.fetch?.metadata,
        )
        expect(newConfig?.[0].value.fetch.data.saltoIDSettings).toMatchObject(
          currentConfig.fetch?.data?.saltoIDSettings ?? {},
        )
        expect(newConfig?.[0].value.fetch.data.includeObjects).toEqual(
          currentConfig.fetch?.data?.includeObjects,
        )
      })

      it('should add the object name to excludeObjects and remove it from allowReferenceTo', () => {
        expect(newConfig?.[0].value.fetch.data.excludeObjects).toContain(
          refToObjectName,
        )
        expect(newConfig?.[0].value.fetch.data.allowReferenceTo).not.toContain(
          refToObjectName,
        )
      })

      it('should not change the currentConfig', () => {
        expect(cloneOfCurrentConfig).toEqual(currentConfig)
      })
    })
    describe('maxItemInRetrieveRequest suggestions', () => {
      it('should use the smallest suggested value', () => {
        const suggestions = [
          { type: MAX_ITEMS_IN_RETRIEVE_REQUEST, value: 3000 },
          { type: MAX_ITEMS_IN_RETRIEVE_REQUEST, value: 2400 },
          { type: MAX_ITEMS_IN_RETRIEVE_REQUEST, value: 5000 },
        ] as ConfigChangeSuggestion[]
        const newConfig = getConfigFromConfigChanges(
          suggestions,
          currentConfig,
        )?.config
        expect(newConfig?.[0].value.maxItemsInRetrieveRequest).toEqual(2400)
      })

      it('should suggest no less than the minimum', () => {
        const suggestions = [
          { type: MAX_ITEMS_IN_RETRIEVE_REQUEST, value: 50 },
        ] as ConfigChangeSuggestion[]
        const newConfig = getConfigFromConfigChanges(
          suggestions,
          currentConfig,
        )?.config
        expect(newConfig?.[0].value.maxItemsInRetrieveRequest).toEqual(
          MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        )
      })
    })
  })

  describe('metadata suggestions', () => {
    let newConfig: InstanceElement | undefined

    beforeEach(() => {
      const suggestions: ConfigChangeSuggestion[] = [
        {
          type: 'metadataExclude',
          value: { metadataType: 'ExcludedType' },
        },
      ]

      newConfig = getConfigFromConfigChanges(suggestions, currentConfig)
        ?.config[0]
    })
    it('should add new excluded type', () => {
      expect(newConfig?.value?.fetch?.metadata?.exclude).toEqual([
        { metadataType: 'Type1' },
        { metadataType: 'ExcludedType' },
      ])
    })
    it('should not overwrite other settings', () => {
      expect(
        newConfig?.value?.fetch?.metadata?.objectsToSeperateFieldsToFiles,
      ).toEqual(['Type2'])
    })
  })
})
