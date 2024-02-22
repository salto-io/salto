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
import {
  CORE_ANNOTATIONS,
  Values,
  Element,
  isInstanceElement,
  InstanceElement,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { LastChangeDateOfTypesWithNestedInstances } from '../../src/types'
import { mockInstances, mockTypes } from '../mock_elements'
import filterCreator from '../../src/filters/changed_at_singleton'
import {
  CHANGED_AT_SINGLETON,
  CUSTOM_OBJECT,
  FLOW_METADATA_TYPE,
  DATA_INSTANCES_CHANGED_AT_MAGIC,
} from '../../src/constants'
import { apiName } from '../../src/transformers/transformer'
import {
  defaultFilterContext,
  emptyLastChangeDateOfTypesWithNestedInstances,
} from '../utils'
import { FilterWith } from './mocks'

describe('createChangedAtSingletonInstanceFilter', () => {
  let lastChangeDateOfTypesWithNestedInstances: LastChangeDateOfTypesWithNestedInstances
  beforeEach(() => {
    lastChangeDateOfTypesWithNestedInstances = {
      ...emptyLastChangeDateOfTypesWithNestedInstances(),
      // Make sure we filter out CustomLabels when none exist in the workspace
      CustomLabels: undefined,
      [CUSTOM_OBJECT]: {
        SBQQ__Template__c: '2023-03-01T00:00:00.000Z',
      },
    }
  })
  describe('onFetch', () => {
    const CHANGED_AT = '2023-03-28T00:00:00.000Z'
    describe('when ChangedAtSingleton instance exists in the elementsSource', () => {
      let updatedInstanceTypeName: string
      let updatedInstanceName: string
      let previousChangedAtSingletonValue: Values
      let fetchedElements: Element[]

      beforeEach(async () => {
        const instances = mockInstances()
        const updatedInstance = instances.Profile
        updatedInstanceTypeName = await apiName(await updatedInstance.getType())
        updatedInstanceName = await apiName(updatedInstance)
        updatedInstance.annotations = {
          ...updatedInstance.annotations,
          [CORE_ANNOTATIONS.CHANGED_AT]: CHANGED_AT,
        }

        const changedAtSingleton = instances.ChangedAtSingleton
        changedAtSingleton.value = {
          ...changedAtSingleton.value,
          [updatedInstanceTypeName]: {
            [updatedInstanceName]: '2023-03-01T00:00:00.000Z',
            NonModifiedInstance: '2023-03-01T00:00:00.000Z',
          },
          [FLOW_METADATA_TYPE]: {
            TestFlow: '2023-03-01T00:00:00.000Z',
            AnotherTestFlow: '2023-03-01T00:00:00.000Z',
          },
        }
        previousChangedAtSingletonValue = changedAtSingleton.clone().value
        const filter = filterCreator({
          config: {
            ...defaultFilterContext,
            elementsSource: buildElementsSourceFromElements([
              changedAtSingleton,
            ]),
            lastChangeDateOfTypesWithNestedInstances,
          },
        }) as FilterWith<'onFetch'>
        fetchedElements = [updatedInstance]
        await filter.onFetch(fetchedElements)
      })
      it('should only update the info about the changed instances', async () => {
        const changedAtSingleton = fetchedElements
          .filter(isInstanceElement)
          .find(
            (e) => e.elemID.typeName === CHANGED_AT_SINGLETON,
          ) as InstanceElement
        expect(changedAtSingleton).toBeDefined()
        expect(changedAtSingleton.value).not.toEqual(
          previousChangedAtSingletonValue,
        )
        const expectedValues = _.cloneDeep(previousChangedAtSingletonValue)
        _.set(
          expectedValues,
          [updatedInstanceTypeName, updatedInstanceName],
          CHANGED_AT,
        )
        expect(changedAtSingleton.value).toEqual({
          ...lastChangeDateOfTypesWithNestedInstances,
          ...expectedValues,
        })
      })
    })
    describe('when ChangedAtSingleton instance does not exist in the elementsSource', () => {
      let updatedInstanceTypeName: string
      let updatedInstanceName: string
      let fetchedElements: Element[]

      beforeEach(async () => {
        const metadataInstance = mockInstances().Profile
        updatedInstanceTypeName = await apiName(
          await metadataInstance.getType(),
        )
        updatedInstanceName = await apiName(metadataInstance)
        metadataInstance.annotations = {
          ...metadataInstance.annotations,
          [CORE_ANNOTATIONS.CHANGED_AT]: CHANGED_AT,
        }
        const customObject = mockTypes.SBQQ__Template__c
        customObject.annotations[CORE_ANNOTATIONS.CHANGED_AT] = CHANGED_AT

        const dataInstance = new InstanceElement(
          'dataInstance',
          customObject,
          {
            Name: 'TestDataInstance',
            Id: '13560',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.CHANGED_AT]: CHANGED_AT,
          },
        )

        const filter = filterCreator({
          config: {
            ...defaultFilterContext,
            lastChangeDateOfTypesWithNestedInstances,
          },
        }) as FilterWith<'onFetch'>
        fetchedElements = [metadataInstance, customObject, dataInstance]
        await filter.onFetch(fetchedElements)
      })
      it('should create the singleton with correct values', async () => {
        const changedAtSingleton = fetchedElements
          .filter(isInstanceElement)
          .find((e) => e.elemID.typeName === CHANGED_AT_SINGLETON)
        expect(changedAtSingleton).toBeDefined()
        expect(changedAtSingleton?.value).toEqual({
          ..._.omit(lastChangeDateOfTypesWithNestedInstances, 'CustomLabels'),
          [updatedInstanceTypeName]: {
            [updatedInstanceName]: CHANGED_AT,
          },
          [DATA_INSTANCES_CHANGED_AT_MAGIC]: {
            SBQQ__Template__c: CHANGED_AT,
          },
        })
      })
    })
  })
})
