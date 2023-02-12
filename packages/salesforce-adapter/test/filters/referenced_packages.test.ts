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
  ElemID,
  InstanceElement,
  ObjectType,
  SaltoError,
  Element,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import filterCreator from '../../src/filters/referenced_packages'
import { mockTypes } from '../mock_elements'
import { FIELD_ANNOTATIONS, INSTALLED_PACKAGE_METADATA, INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { createCustomObjectType } from '../utils'
import { FilterResult } from '../../src/filter'

const { makeArray } = collections.array

describe(filterCreator.name, () => {
  const filter = filterCreator()
  describe('onFetch', () => {
    const FIELD_NAME = 'field'
    const REFERENCED_PACKAGE_NAME = 'referenced'

    let instance: InstanceElement
    let instanceFromInstalledPackage: InstanceElement
    let objectType: ObjectType
    let installedPackageInstance: InstanceElement
    let elements: Element[]

    let fetchWarnings: SaltoError[]

    beforeEach(() => {
      objectType = createCustomObjectType('MockType__c', {
        fields: {
          [FIELD_NAME]: {
            refType: Types.primitiveDataTypes.MetadataRelationship,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [
                `${REFERENCED_PACKAGE_NAME}__test`,
              ],
            },
          },
        },
      })
      instance = new InstanceElement(
        'testInstance',
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'MockInstanceType') }),
        {
          [INSTANCE_FULL_NAME_FIELD]: 'testInstance',
          [FIELD_NAME]: `${REFERENCED_PACKAGE_NAME}__test`,
        },
      )
      instanceFromInstalledPackage = new InstanceElement(
        `${REFERENCED_PACKAGE_NAME}__testInstance`,
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'MockInstanceType') }),
        {
          [INSTANCE_FULL_NAME_FIELD]: `${REFERENCED_PACKAGE_NAME}__testInstance`,
        },
      )
      installedPackageInstance = new InstanceElement(
        REFERENCED_PACKAGE_NAME,
        mockTypes[INSTALLED_PACKAGE_METADATA],
        {
          [INSTANCE_FULL_NAME_FIELD]: REFERENCED_PACKAGE_NAME,
        },
      )
      elements = [objectType, instance, instanceFromInstalledPackage, installedPackageInstance]
    })
    describe('with references', () => {
      beforeEach(async () => {
        instance.value[FIELD_NAME] = new ReferenceExpression(new ElemID(SALESFORCE, 'mock'), instance.value[FIELD_NAME])
        const field = objectType.fields[FIELD_NAME]
        field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO] = [
          new ReferenceExpression(new ElemID(SALESFORCE, 'mock'), field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO][0]),
        ]
        const fetchResult = await filter.onFetch(elements) as FilterResult
        fetchWarnings = makeArray(fetchResult.errors)
      })
      it('should not add generated dependencies or create fetch warnings', () => {
        expect(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
        expect(instanceFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
        expect(objectType.fields[FIELD_NAME].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
        expect(fetchWarnings).toBeEmpty()
      })
    })
    describe('without references', () => {
      beforeEach(async () => {
        const fetchResult = await filter.onFetch(elements) as FilterResult
        fetchWarnings = makeArray(fetchResult.errors)
      })
      it('should add the referenced InstalledPackage instance to the generated dependencies list and create fetch warning', () => {
        expect(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
          expect.objectContaining({
            reference: expect.objectContaining({ elemID: installedPackageInstance.elemID }),
          }),
        ])
        expect(objectType.fields[FIELD_NAME].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
          expect.objectContaining({
            reference: expect.objectContaining({ elemID: installedPackageInstance.elemID }),
          }),
        ])
        expect(instanceFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
          .toBeUndefined()
        expect(fetchWarnings).toEqual([
          expect.objectContaining({ severity: 'Warning' }),
        ])
      })
    })
  })
})
