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
import { InstanceElement } from '@salto-io/adapter-api'
import { ConfigChangeSuggestion, DATA_MANAGEMENT } from '../src/types'
import { getConfigFromConfigChanges } from '../src/config_change'

describe('Config Changes', () => {
  const includedObjectName = 'Object'
  const refToObjectName = 'refTo'
  const currentConfig = {
    metadataTypesSkippedList: ['Type1'],
    dataManagement: {
      includeObjects: [includedObjectName],
      allowReferenceTo: [refToObjectName],
      saltoIDSettings: {
        defaultIdFields: ['Name'],
      },
    },
  }
  it('should return undefined if no suggested changes', () => {
    const suggestedInstance = getConfigFromConfigChanges([], currentConfig)
    expect(suggestedInstance).toBeUndefined()
  })

  describe('getConfigFromConfigChanges - dataManagement suggestions', () => {
    describe('when suggestion is about an object that appears in includeObjects', () => {
      let newConfig: InstanceElement | undefined
      beforeAll(() => {
        const suggestToRemoveObject = {
          type: DATA_MANAGEMENT,
          value: includedObjectName,
        } as ConfigChangeSuggestion
        newConfig = getConfigFromConfigChanges([suggestToRemoveObject], currentConfig)
      })

      it('should create an instance with values same as original config besides excludeObjects', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.value.metadataTypesSkippedList)
          .toEqual(currentConfig.metadataTypesSkippedList)
        expect(newConfig?.value.dataManagement).toMatchObject(currentConfig.dataManagement)
      })

      it('should add the object name to excludeObjects', () => {
        expect(newConfig?.value.dataManagement.excludeObjects).toContain(includedObjectName)
      })
    })

    describe('when suggestion is about an object that appears in allowReferenceTo', () => {
      let newConfig: InstanceElement | undefined
      beforeAll(() => {
        const suggestToRemoveObject = {
          type: DATA_MANAGEMENT,
          value: refToObjectName,
        } as ConfigChangeSuggestion
        newConfig = getConfigFromConfigChanges([suggestToRemoveObject], currentConfig)
      })

      it('should create an instance with values same as original config besides excludeObjects and allowReferenceTo', () => {
        expect(newConfig).toBeDefined()
        expect(newConfig?.value.metadataTypesSkippedList)
          .toEqual(currentConfig.metadataTypesSkippedList)
        expect(newConfig?.value.dataManagement.saltoIDSettings)
          .toMatchObject(currentConfig.dataManagement.saltoIDSettings)
        expect(newConfig?.value.dataManagement.includeObjects)
          .toEqual(currentConfig.dataManagement.includeObjects)
      })

      it('should add the object name to excludeObjects and remove it from allowReferenceTo', () => {
        expect(newConfig?.value.dataManagement.excludeObjects).toContain(refToObjectName)
        expect(newConfig?.value.dataManagement.allowReferenceTo).not.toContain(refToObjectName)
      })
    })
  })
})
