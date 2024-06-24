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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  Field,
} from '@salto-io/adapter-api'
import { createInstanceElement } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'
import { createCustomMetadataType, createCustomObjectType } from '../utils'
import { API_NAME } from '../../src/constants'
import { managedElementsHandler } from '../../src/custom_references/managed_elements'

describe('managed elements', () => {
  describe('weak references handler', () => {
    const NAMESPACE = 'namespace1'
    const PACKAGE_ID = ElemID.fromFullName(
      'salesforce.InstalledPackage.instance.namespace1',
    )

    describe('CustomObjects', () => {
      let customObject: ObjectType
      let customObjectFromInstalledPackage: ObjectType

      beforeEach(() => {
        customObject = createCustomObjectType('TestObject__c', {})
        customObjectFromInstalledPackage = createCustomObjectType(
          `${NAMESPACE}__TestObject__c`,
          {},
        )
      })

      it('should generate weak references', async () => {
        const refs = await managedElementsHandler.findWeakReferences([
          customObject,
          customObjectFromInstalledPackage,
        ])
        expect(refs).toEqual([
          {
            source: customObjectFromInstalledPackage.elemID,
            target: PACKAGE_ID,
            type: 'strong',
          },
        ])
      })

      describe('Standard Object Custom Fields', () => {
        let customFieldFromInstalledPackage: Field
        let accountType: ObjectType

        beforeEach(() => {
          accountType = mockTypes.Account.clone()
          const customField = new Field(
            mockTypes.Account,
            'TestField__c',
            BuiltinTypes.STRING,
            { [API_NAME]: 'TestField__c' },
          )
          customFieldFromInstalledPackage = new Field(
            mockTypes.Account,
            `${NAMESPACE}__TestField__c`,
            BuiltinTypes.STRING,
            { [API_NAME]: `${NAMESPACE}__TestField__c` },
          )
          accountType.fields[customField.name] = customField
          accountType.fields[customFieldFromInstalledPackage.name] =
            customFieldFromInstalledPackage
        })

        it('should generate weak references', async () => {
          const refs = await managedElementsHandler.findWeakReferences([
            accountType,
          ])
          expect(refs).toEqual([
            {
              source: customFieldFromInstalledPackage.elemID,
              target: PACKAGE_ID,
              type: 'strong',
            },
          ])
        })
      })

      describe('CustomMetadata types', () => {
        let customMetadata: ObjectType
        let customMetadataFromInstalledPackage: ObjectType

        beforeEach(() => {
          customMetadata = createCustomMetadataType(
            'TestCustomMetadata__mdt',
            {},
          )
          customMetadataFromInstalledPackage = createCustomMetadataType(
            `${NAMESPACE}__TestCustomMetadata__mdt`,
            {},
          )
        })

        it('should generate weak references', async () => {
          const refs = await managedElementsHandler.findWeakReferences([
            customMetadata,
            customMetadataFromInstalledPackage,
          ])
          expect(refs).toEqual([
            {
              source: customMetadataFromInstalledPackage.elemID,
              target: PACKAGE_ID,
              type: 'strong',
            },
          ])
        })
      })

      describe('Instances', () => {
        let instance: InstanceElement
        let instanceFromInstalledPackage: InstanceElement

        beforeEach(() => {
          instance = createInstanceElement(
            { fullName: 'TestInstance' },
            mockTypes.ApexClass,
          )
          instanceFromInstalledPackage = createInstanceElement(
            { fullName: `${NAMESPACE}__TestInstance` },
            mockTypes.ApexClass,
          )
        })

        it('should generate weak references', async () => {
          const refs = await managedElementsHandler.findWeakReferences([
            instance,
            instanceFromInstalledPackage,
          ])
          expect(refs).toEqual([
            {
              source: instanceFromInstalledPackage.elemID,
              target: PACKAGE_ID,
              type: 'strong',
            },
          ])
        })
      })
    })
  })
})
