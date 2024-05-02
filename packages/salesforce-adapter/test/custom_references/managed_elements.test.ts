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
  Element,
  InstanceElement,
  ReferenceInfo,
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
    let installedPackageInstances: Element[]
    let refs: ReferenceInfo[]

    beforeEach(() => {
      installedPackageInstances = [
        createInstanceElement(
          { fullName: NAMESPACE },
          mockTypes.InstalledPackage,
        ),
        createInstanceElement(
          { fullName: 'namespace1' },
          mockTypes.InstalledPackage,
        ),
      ]
    })

    describe('CustomObjects', () => {
      let customObject: ObjectType
      let customObjectFromInstalledPackage: ObjectType

      beforeEach(async () => {
        customObject = createCustomObjectType('TestObject__c', {})
        customObjectFromInstalledPackage = createCustomObjectType(
          `${NAMESPACE}__TestObject__c`,
          {},
        )
        refs = await managedElementsHandler.findWeakReferences(
          installedPackageInstances.concat([
            customObject,
            customObjectFromInstalledPackage,
          ]),
        )
      })

      it('should generate weak references', () => {
        expect(refs).toEqual([
          {
            source: customObjectFromInstalledPackage.elemID,
            target: installedPackageInstances[0].elemID,
            type: 'weak',
          },
        ])
      })
    })

    describe('Standard Object Custom Fields', () => {
      let customField: Field
      let customFieldFromInstalledPackage: Field

      beforeEach(async () => {
        const accountType = mockTypes.Account.clone()
        customField = new Field(
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
        refs = await managedElementsHandler.findWeakReferences(
          installedPackageInstances.concat([accountType]),
        )
      })

      it('should generate weak references', () => {
        expect(refs).toEqual([
          {
            source: customFieldFromInstalledPackage.elemID,
            target: installedPackageInstances[0].elemID,
            type: 'weak',
          },
        ])
      })
    })

    describe('CustomMetadata types', () => {
      let customMetadata: ObjectType
      let customMetadataFromInstalledPackage: ObjectType

      beforeEach(async () => {
        customMetadata = createCustomMetadataType('TestCustomMetadata__mdt', {})
        customMetadataFromInstalledPackage = createCustomMetadataType(
          `${NAMESPACE}__TestCustomMetadata__mdt`,
          {},
        )
        refs = await managedElementsHandler.findWeakReferences(
          installedPackageInstances.concat([
            customMetadata,
            customMetadataFromInstalledPackage,
          ]),
        )
      })

      it('should generate weak references', () => {
        expect(refs).toEqual([
          {
            source: customMetadataFromInstalledPackage.elemID,
            target: installedPackageInstances[0].elemID,
            type: 'weak',
          },
        ])
      })
    })

    describe('Instances', () => {
      let instance: InstanceElement
      let instanceFromInstalledPackage: InstanceElement

      beforeEach(async () => {
        instance = createInstanceElement(
          { fullName: 'TestInstance' },
          mockTypes.ApexClass,
        )
        instanceFromInstalledPackage = createInstanceElement(
          { fullName: `${NAMESPACE}__TestInstance` },
          mockTypes.ApexClass,
        )
        refs = await managedElementsHandler.findWeakReferences(
          installedPackageInstances.concat([
            instance,
            instanceFromInstalledPackage,
          ]),
        )
      })

      it('should generate weak references', () => {
        expect(refs).toEqual([
          {
            source: instanceFromInstalledPackage.elemID,
            target: installedPackageInstances[0].elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
})
