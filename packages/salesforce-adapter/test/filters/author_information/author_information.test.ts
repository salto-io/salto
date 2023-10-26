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
import {
  InstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockInstances } from '../../mock_elements'
import { createChangedAtInformation, ChangedAtInformation } from '../../../src/filters/author_information/changed_at_info'
import { CUSTOM_OBJECT } from '../../../src/constants'

describe('createChangedAtInformation', () => {
  describe('backingElement', () => {
    let elementsSource: ReadOnlyElementsSource
    describe('when the ChangedAtSingleton instance exists in the elementsSource', () => {
      let changedAtSingleton: InstanceElement
      beforeEach(() => {
        changedAtSingleton = mockInstances().ChangedAtSingleton
        elementsSource = buildElementsSourceFromElements([changedAtSingleton])
      })
      it('should return the singleton', async () => {
        expect((await createChangedAtInformation(elementsSource)).backingElement()).toEqual(changedAtSingleton)
      })
    })

    describe('when the ChangedAtSingleton instance does not exist in the elementsSource', () => {
      beforeEach(() => {
        elementsSource = buildElementsSourceFromElements([])
      })
      it('should return a new singleton', async () => {
        expect((await createChangedAtInformation(elementsSource)).backingElement()).toBeInstanceOf(InstanceElement)
      })
    })
  })
  describe('changedAt', () => {
    let changedAtInfo: ChangedAtInformation
    const typeName = 'Account'
    const changedAt = 'SOME_DATE'

    beforeEach(async () => {
      changedAtInfo = await createChangedAtInformation(buildElementsSourceFromElements([]))
    })

    describe('when there`s no information for type', () => {
      it('should not return information', () => {
        expect(changedAtInfo.typeChangedAt(CUSTOM_OBJECT, typeName)).not.toBeDefined()
      })
    })

    describe('when the information is explicitly set', () => {
      describe('when there`s no pre-existing information', () => {
        beforeEach(() => {
          changedAtInfo.updateTypesChangedAt({ [CUSTOM_OBJECT]: { [typeName]: changedAt } })
        })
        it('should return the provided information', () => {
          expect(changedAtInfo.typeChangedAt(CUSTOM_OBJECT, typeName)).toEqual(changedAt)
        })
      })
      describe('when there is pre-existing information', () => {
        beforeEach(() => {
          changedAtInfo.updateTypesChangedAt({ [CUSTOM_OBJECT]: { [typeName]: 'SOME_OTHER_DATE' } })
          changedAtInfo.updateTypesChangedAt({ [CUSTOM_OBJECT]: { [typeName]: changedAt } })
        })
        it('should return the new information', () => {
          expect(changedAtInfo.typeChangedAt(CUSTOM_OBJECT, typeName)).toEqual(changedAt)
        })
      })
    })
  })
})
