/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { buildFilterContext, createCustomMetadataType, createCustomObjectType } from '../utils'
import filterCreator from '../../src/filters/installed_package_generated_dependencies'
import { API_NAME } from '../../src/constants'
import { FilterWith } from './mocks'

describe('installedPackageElementsFilter', () => {
  const NAMESPACE = 'namespace1'

  let installedPackageInstances: InstanceElement[]
  let filter: FilterWith<'onFetch'>

  describe('onFetch', () => {
    describe('when managedElements custom references are disabled', () => {
      beforeEach(() => {
        installedPackageInstances = [
          createInstanceElement({ fullName: NAMESPACE }, mockTypes.InstalledPackage),
          createInstanceElement({ fullName: 'namespace1' }, mockTypes.InstalledPackage),
        ]
        filter = filterCreator({
          config: buildFilterContext({
            customReferencesSettings: {
              managedElements: false,
            },
          }),
        }) as FilterWith<'onFetch'>
      })

      describe('CustomObjects', () => {
        let customObject: ObjectType
        let customObjectFromInstalledPackage: ObjectType

        beforeEach(async () => {
          customObject = createCustomObjectType('TestObject__c', {})
          customObjectFromInstalledPackage = createCustomObjectType(`${NAMESPACE}__TestObject__c`, {})
          await filter.onFetch([...installedPackageInstances, customObject, customObjectFromInstalledPackage])
        })

        it('should add generated dependencies', () => {
          expect(customObject.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(customObjectFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
            {
              reference: expect.objectContaining({
                elemID: expect.objectContaining({
                  name: NAMESPACE,
                }),
              }),
            },
          ])
        })
      })

      describe('Standard Object Custom Fields', () => {
        let customField: Field
        let customFieldFromInstalledPackage: Field

        beforeEach(async () => {
          const accountType = mockTypes.Account.clone()
          customField = new Field(mockTypes.Account, 'TestField__c', BuiltinTypes.STRING, {
            [API_NAME]: 'TestField__c',
          })
          customFieldFromInstalledPackage = new Field(
            mockTypes.Account,
            `${NAMESPACE}__TestField__c`,
            BuiltinTypes.STRING,
            { [API_NAME]: `${NAMESPACE}__TestField__c` },
          )
          accountType.fields[customField.name] = customField
          accountType.fields[customFieldFromInstalledPackage.name] = customFieldFromInstalledPackage
          await filter.onFetch([...installedPackageInstances, accountType])
        })

        it('should add generated dependencies', () => {
          expect(customField.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(customFieldFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
            {
              reference: expect.objectContaining({
                elemID: expect.objectContaining({
                  name: NAMESPACE,
                }),
              }),
            },
          ])
        })
      })

      describe('CustomMetadata types', () => {
        let customMetadata: ObjectType
        let customMetadataFromInstalledPackage: ObjectType

        beforeEach(async () => {
          customMetadata = createCustomMetadataType('TestCustomMetadata__mdt', {})
          customMetadataFromInstalledPackage = createCustomMetadataType(`${NAMESPACE}__TestCustomMetadata__mdt`, {})
          await filter.onFetch([...installedPackageInstances, customMetadata, customMetadataFromInstalledPackage])
        })

        it('should add generated dependencies', () => {
          expect(customMetadata.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(customMetadataFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
            {
              reference: expect.objectContaining({
                elemID: expect.objectContaining({
                  name: NAMESPACE,
                }),
              }),
            },
          ])
        })
      })

      describe('Instances', () => {
        let instance: InstanceElement
        let instanceFromInstalledPackage: InstanceElement

        beforeEach(async () => {
          instance = createInstanceElement({ fullName: 'TestInstance' }, mockTypes.ApexClass)
          instanceFromInstalledPackage = createInstanceElement(
            { fullName: `${NAMESPACE}__TestInstance` },
            mockTypes.ApexClass,
          )
          await filter.onFetch([...installedPackageInstances, instance, instanceFromInstalledPackage])
        })

        it('should add generated dependencies', () => {
          expect(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(instanceFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
            {
              reference: expect.objectContaining({
                elemID: expect.objectContaining({
                  name: NAMESPACE,
                }),
              }),
            },
          ])
        })
      })
    })

    describe('when managedElements custom references are enabled', () => {
      beforeEach(() => {
        installedPackageInstances = [
          createInstanceElement({ fullName: NAMESPACE }, mockTypes.InstalledPackage),
          createInstanceElement({ fullName: 'namespace1' }, mockTypes.InstalledPackage),
        ]
        filter = filterCreator({
          config: buildFilterContext({
            customReferencesSettings: {
              managedElements: true,
            },
          }),
        }) as FilterWith<'onFetch'>
      })

      describe('CustomObjects', () => {
        let customObject: ObjectType
        let customObjectFromInstalledPackage: ObjectType

        beforeEach(async () => {
          customObject = createCustomObjectType('TestObject__c', {})
          customObjectFromInstalledPackage = createCustomObjectType(`${NAMESPACE}__TestObject__c`, {})
          await filter.onFetch([...installedPackageInstances, customObject, customObjectFromInstalledPackage])
        })

        it('should add generated dependencies', () => {
          expect(customObject.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(customObjectFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
        })
      })

      describe('Standard Object Custom Fields', () => {
        let customField: Field
        let customFieldFromInstalledPackage: Field

        beforeEach(async () => {
          const accountType = mockTypes.Account.clone()
          customField = new Field(mockTypes.Account, 'TestField__c', BuiltinTypes.STRING, {
            [API_NAME]: 'TestField__c',
          })
          customFieldFromInstalledPackage = new Field(
            mockTypes.Account,
            `${NAMESPACE}__TestField__c`,
            BuiltinTypes.STRING,
            { [API_NAME]: `${NAMESPACE}__TestField__c` },
          )
          accountType.fields[customField.name] = customField
          accountType.fields[customFieldFromInstalledPackage.name] = customFieldFromInstalledPackage
          await filter.onFetch([...installedPackageInstances, accountType])
        })

        it('should add generated dependencies', () => {
          expect(customField.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(customFieldFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
        })
      })

      describe('CustomMetadata types', () => {
        let customMetadata: ObjectType
        let customMetadataFromInstalledPackage: ObjectType

        beforeEach(async () => {
          customMetadata = createCustomMetadataType('TestCustomMetadata__mdt', {})
          customMetadataFromInstalledPackage = createCustomMetadataType(`${NAMESPACE}__TestCustomMetadata__mdt`, {})
          await filter.onFetch([...installedPackageInstances, customMetadata, customMetadataFromInstalledPackage])
        })

        it('should add generated dependencies', () => {
          expect(customMetadata.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(
            customMetadataFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES],
          ).toBeUndefined()
        })
      })

      describe('Instances', () => {
        let instance: InstanceElement
        let instanceFromInstalledPackage: InstanceElement

        beforeEach(async () => {
          instance = createInstanceElement({ fullName: 'TestInstance' }, mockTypes.ApexClass)
          instanceFromInstalledPackage = createInstanceElement(
            { fullName: `${NAMESPACE}__TestInstance` },
            mockTypes.ApexClass,
          )
          await filter.onFetch([...installedPackageInstances, instance, instanceFromInstalledPackage])
        })

        it('should add generated dependencies', () => {
          expect(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
          expect(instanceFromInstalledPackage.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
        })
      })
    })
  })
})
