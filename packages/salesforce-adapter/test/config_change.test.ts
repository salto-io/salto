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
import { getConfigFromConfigChanges, getConfigChangeMessage, DEPRECATED_OPTIONS_MESSAGE, PACKAGES_INSTANCES_REGEX } from '../src/config_change'

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
      let newConfig: { config: InstanceElement; message: string } | undefined
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
        expect(newConfig?.config?.value.fetch.metadata)
          .toEqual(currentConfig.fetch?.metadata)

        const currentConfigClone = _.cloneDeep(currentConfig)
        delete currentConfigClone.fetch?.data?.excludeObjects

        expect(newConfig?.config?.value.fetch.data)
          .toMatchObject(currentConfigClone.fetch?.data ?? {})
      })

      it('should add the object name to excludeObjects', () => {
        expect(newConfig?.config?.value.fetch.data.excludeObjects)
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
      let newConfig: InstanceElement | undefined
      beforeAll(() => {
        const suggestToRemoveObject = {
          type: 'dataObjectsExclude',
          value: refToObjectName,
        } as ConfigChangeSuggestion
        newConfig = getConfigFromConfigChanges([suggestToRemoveObject], currentConfig)?.config
      })

      it('should create an instance with values same as original config besides excludeObjects and allowReferenceTo', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.value.fetch.metadata)
          .toEqual(currentConfig.fetch?.metadata)
        expect(newConfig?.value.fetch.data.saltoIDSettings)
          .toMatchObject(currentConfig.fetch?.data?.saltoIDSettings ?? {})
        expect(newConfig?.value.fetch.data.includeObjects)
          .toEqual(currentConfig.fetch?.data?.includeObjects)
      })

      it('should add the object name to excludeObjects and remove it from allowReferenceTo', () => {
        expect(newConfig?.value.fetch.data.excludeObjects).toContain(refToObjectName)
        expect(newConfig?.value.fetch.data.allowReferenceTo).not.toContain(refToObjectName)
      })

      it('should not change the currentConfig', () => {
        expect(cloneOfCurrentConfig).toEqual(currentConfig)
      })
    })

    describe('convert from old options to new options', () => {
      it('dataManagement should be converted to fetch.data', () => {
        const configWithOldOptions = {
          fetch: {
            metadata: {
              exclude: [
                { metadataType: 'Type1' },
              ],
            },
          },
          dataManagement: {
            includeObjects: ['aaa', '^eee', 'hhh\\.*'],
            excludeObjects: ['bbb.*', 'fff$'],
            allowReferenceTo: ['.*ccc', '^ggg$'],
            saltoIDSettings: {
              defaultIdFields: ['Name'],
              overrides: [
                {
                  objectsRegex: '.*ddd.*',
                  idFields: [],
                },
              ],
            },
          },
        }

        const updatedConfig = {
          fetch: {
            metadata: {
              exclude: [
                { metadataType: 'Type1' },
              ],
            },
            data: {
              includeObjects: ['.*aaa.*', 'eee.*', '.*hhh\\.*.*'],
              excludeObjects: ['.*bbb.*', '.*fff'],
              allowReferenceTo: ['.*ccc.*', 'ggg'],
              saltoIDSettings: {
                defaultIdFields: ['Name'],
                overrides: [
                  {
                    objectsRegex: '.*ddd.*',
                    idFields: [],
                  },
                ],
              },
            },
          },
        }

        const config = getConfigFromConfigChanges([], configWithOldOptions)
        expect(config?.config?.value).toEqual(updatedConfig)
        expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
      })

      it('metadataTypesSkippedList should be converted to fetch.metadata.exclude', () => {
        const configWithOldOptions = _.cloneDeep(currentConfig)
        configWithOldOptions.metadataTypesSkippedList = ['a', 'b']

        const expectedConfig = _.cloneDeep(currentConfig)
        // eslint-disable-next-line no-unused-expressions
        expectedConfig.fetch?.metadata?.exclude?.push(...[{ metadataType: 'a' }, { metadataType: 'b' }])

        const config = getConfigFromConfigChanges([], configWithOldOptions)
        expect(config?.config?.value).toEqual(expectedConfig)
        expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
      })

      it('instancesRegexSkippedList should be converted correctly', () => {
        const configWithOldOptions = _.cloneDeep(currentConfig)
        configWithOldOptions.instancesRegexSkippedList = ['a', 'a.b', 'a.b.c', PACKAGES_INSTANCES_REGEX]

        const expectedConfig = _.cloneDeep(currentConfig)
        // eslint-disable-next-line no-unused-expressions
        expectedConfig.fetch?.metadata?.exclude?.push(...[
          { name: '.*a.*' },
          { metadataType: '.*a', name: 'b.*' },
          { metadataType: '.*a', name: 'b.c.*' },
        ])

        _.assign(
          expectedConfig.fetch?.metadata,
          {
            include: [{ name: '.*', metadataType: '.*', namespace: '' }],
          }
        )

        const config = getConfigFromConfigChanges([], configWithOldOptions)
        expect(config?.config?.value).toEqual(expectedConfig)
        expect(config?.message).toBe(DEPRECATED_OPTIONS_MESSAGE)
      })
    })

    describe('old configuration option with suggestions', () => {
      const suggestToRemoveObject = {
        type: 'dataObjectsExclude',
        value: refToObjectName,
      } as ConfigChangeSuggestion

      const configWithOldOptions = _.cloneDeep(currentConfig)
      configWithOldOptions.dataManagement = configWithOldOptions.fetch?.data
      delete configWithOldOptions.fetch?.data

      const config = getConfigFromConfigChanges([suggestToRemoveObject], configWithOldOptions)
      it('apply all changes', () => {
        const expectedConfig = _.cloneDeep(currentConfig)
        _.remove(expectedConfig.fetch?.data?.allowReferenceTo ?? [], val => val === refToObjectName)
        // eslint-disable-next-line no-unused-expressions
        expectedConfig.fetch?.data?.excludeObjects?.push(refToObjectName)

        expect(config?.config?.value).toEqual(expectedConfig)
      })
      it('return combined message', () => {
        expect(config?.message).toBe(`The configuration options "metadataTypesSkippedList", "instancesRegexSkippedList" and "dataManagement" are deprecated. The following changes will update the deprected options to the "fetch" configuration option.
In Addition, Salto failed to fetch some items from salesforce. 

In order to complete the fetch operation, Salto needs to stop managing these items by applying the following configuration change:`)
      })
    })
  })
})
