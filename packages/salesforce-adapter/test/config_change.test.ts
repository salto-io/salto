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
import { InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { ConfigChangeSuggestion, SalesforceConfig } from '../src/types'
import { getConfigFromConfigChanges, getConfigChangeMessage, ConfigChange } from '../src/config_change'

describe('Config Changes', () => {
  const includedObjectName = '.*Object.*'
  const refToObjectName = '.*refTo.*'
  const currentConfig: SalesforceConfig = {
    fetch: {
      metadata: {
        exclude: [
          { metadataType: 'Type1' },
        ],
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
    const suggestedInstance = getConfigFromConfigChanges([], cloneOfCurrentConfig)
    expect(suggestedInstance).toBeUndefined()
    expect(cloneOfCurrentConfig).toEqual(currentConfig)
  })

  describe('getConfigChangeMessage', () => {
    const configChangeWithoutReason = {
      type: 'dataObjectsExclude',
      value: 'something',
    } as ConfigChangeSuggestion

    const configChangeWithReason = {
      type: 'dataObjectsExclude',
      value: 'somethingElse',
      reason: 'because',
    } as ConfigChangeSuggestion

    it('should return a message with only into and summary without reasons intro/content if no reasons in config changes', () => {
      const message = getConfigChangeMessage([configChangeWithoutReason])
      expect(message).not.toMatch('Due to the following issues:')
      expect(message).toMatch('Salto failed to fetch some items from salesforce.')
      expect(message).toMatch('Salto needs to stop managing these items by applying the following configuration change:')
    })

    it('should return a message with into/summary + reasons content+intro when there are reasons', () => {
      const message = getConfigChangeMessage([configChangeWithReason])
      expect(message).toMatch('Due to the following issues:')
      expect(message).toMatch('   * because')
      expect(message).toMatch('Salto failed to fetch some items from salesforce.')
      expect(message).toMatch('Salto needs to stop managing these items by applying the following configuration change:')
    })
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
          cloneOfCurrentConfig
        )
      })

      it('should create an instance with values same as original config besides excludeObjects', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.config?.[0].value.fetch.metadata)
          .toEqual(currentConfig.fetch?.metadata)

        const currentConfigClone = _.cloneDeep(currentConfig)
        delete currentConfigClone.fetch?.data?.excludeObjects

        expect(newConfig?.config?.[0].value.fetch.data)
          .toMatchObject(currentConfigClone.fetch?.data ?? {})
      })

      it('should add the object name to excludeObjects', () => {
        expect(newConfig?.config?.[0].value.fetch.data.excludeObjects)
          .toContain(includedObjectName)
      })

      it('should not change the currentConfig', () => {
        expect(cloneOfCurrentConfig).toEqual(currentConfig)
      })

      it('should return the message for the suggestion', () => {
        expect(newConfig?.message).toEqual(`Salto failed to fetch some items from salesforce. 

In order to complete the fetch operation, Salto needs to stop managing these items by applying the following configuration change:`)
      })
    })

    describe('when suggestion is about an object that appears in allowReferenceTo', () => {
      let newConfig: InstanceElement[] | undefined
      beforeAll(() => {
        const suggestToRemoveObject = {
          type: 'dataObjectsExclude',
          value: refToObjectName,
        } as ConfigChangeSuggestion
        newConfig = getConfigFromConfigChanges([suggestToRemoveObject], currentConfig)?.config
      })

      it('should create an instance with values same as original config besides excludeObjects and allowReferenceTo', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.[0].value.fetch.metadata)
          .toEqual(currentConfig.fetch?.metadata)
        expect(newConfig?.[0].value.fetch.data.saltoIDSettings)
          .toMatchObject(currentConfig.fetch?.data?.saltoIDSettings ?? {})
        expect(newConfig?.[0].value.fetch.data.includeObjects)
          .toEqual(currentConfig.fetch?.data?.includeObjects)
      })

      it('should add the object name to excludeObjects and remove it from allowReferenceTo', () => {
        expect(newConfig?.[0].value.fetch.data.excludeObjects).toContain(refToObjectName)
        expect(newConfig?.[0].value.fetch.data.allowReferenceTo).not.toContain(refToObjectName)
      })

      it('should not change the currentConfig', () => {
        expect(cloneOfCurrentConfig).toEqual(currentConfig)
      })
    })
  })
})
