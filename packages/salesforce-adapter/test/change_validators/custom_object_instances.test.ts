/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  InstanceElement,
  ChangeError,
  toChange,
  ChangeValidator,
  Change,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { DescribeSObjectResult } from '@salto-io/jsforce'
import changeValidatorCreator from '../../src/change_validators/custom_object_instances'
import { METADATA_TYPE, CUSTOM_OBJECT, API_NAME } from '../../src/constants'
import mockClient from '../client'
import { SalesforceClient } from '../../index'
import { mockTypes } from '../mock_elements'

describe('custom object instances change validator', () => {
  let customObjectInstancesValidator: ChangeValidator
  let client: SalesforceClient
  const obj = new ObjectType({
    elemID: new ElemID('salesforce', 'obj'),
    fields: {
      nonUpdateable: {
        refType: BuiltinTypes.STRING,
      },
      nonCreatable: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'obj__c',
    },
  })
  beforeEach(() => {
    client = mockClient().client
    jest.spyOn(client, 'describeSObjects').mockResolvedValue({
      result: [
        {
          name: 'obj',
          createable: true,
          updateable: true,
          fields: [
            {
              name: 'nonUpdateable',
              updateable: false,
              createable: true,
              queryable: true,
            },
            {
              name: 'nonCreatable',
              updateable: true,
              createable: false,
              queryable: true,
            },
          ],
        } as unknown as DescribeSObjectResult,
      ],
      errors: [],
    })
    customObjectInstancesValidator = changeValidatorCreator(client)
  })

  describe('onAdd of instance of customObject', () => {
    let changeErrors: Readonly<ChangeError[]>
    let instance: InstanceElement
    it('should have change error with warning when adding a non-creatable field', async () => {
      instance = new InstanceElement('instance', obj, {
        nonCreatable: 'doNotCreateMe',
      })
      changeErrors = await customObjectInstancesValidator([toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should have no change error when adding creatable fields only', async () => {
      instance = new InstanceElement('instance', obj, {
        nonUpdateable: 'youCanCreateMe',
      })
      changeErrors = await customObjectInstancesValidator([toChange({ after: instance })])
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('onModify of instance of customObject', () => {
    let changeErrors: Readonly<ChangeError[]>
    const before = new InstanceElement('instance', obj, {
      nonUpdateable: new ReferenceExpression(mockTypes.Account.elemID, mockTypes.Account),
      nonCreatable: 'youCanUpdateMe',
    })
    let after: InstanceElement

    beforeEach(() => {
      after = before.clone()
    })
    it('should have change error with warning when editing a non-updateable field', async () => {
      after.value.nonUpdateable = new ReferenceExpression(mockTypes.Product2.elemID, mockTypes.Product2)
      changeErrors = await customObjectInstancesValidator([toChange({ before, after })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(after.elemID)
    })

    it('should have no change error when editing updateable fields only', async () => {
      const afterInstance = before.clone()
      afterInstance.value.nonCreatable = 'IamTryingToUpdateBeforeICan'
      changeErrors = await customObjectInstancesValidator([toChange({ before, after })])
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('when the deploying user lacks CRUD permissions', () => {
    let addedInstance: InstanceElement
    let modifiedInstance: InstanceElement
    let removedInstance: InstanceElement
    let changes: Change[]

    let changeErrors: readonly ChangeError[]

    beforeEach(async () => {
      addedInstance = new InstanceElement('added', obj, {
        Field__c: 'value',
      })
      modifiedInstance = new InstanceElement('added', obj, {
        Field__c: 'value',
      })
      removedInstance = new InstanceElement('removed', obj, {
        Field__c: 'value',
      })
      changes = [
        toChange({ after: addedInstance }),
        toChange({ before: modifiedInstance, after: modifiedInstance }),
        toChange({ before: removedInstance }),
      ]
    })

    describe('when describe fails on the type', () => {
      beforeEach(async () => {
        jest.spyOn(client, 'describeSObjects').mockRejectedValue(new Error(''))
        changeErrors = await customObjectInstancesValidator(changes)
      })
      it('should create change errors for all type of changes', () => {
        expect(changeErrors).toHaveLength(3)
        expect(changeErrors).toSatisfyAny(
          (e: ChangeError) => e.elemID.isEqual(addedInstance.elemID) && e.message === 'Cannot create records of type',
        )
        expect(changeErrors).toSatisfyAny(
          (e: ChangeError) =>
            e.elemID.isEqual(modifiedInstance.elemID) && e.message === 'Cannot modify records of type',
        )
        expect(changeErrors).toSatisfyAny(
          (e: ChangeError) => e.elemID.isEqual(removedInstance.elemID) && e.message === 'Cannot delete records of type',
        )
      })
    })
    describe('when creatable is false', () => {
      beforeEach(async () => {
        jest.spyOn(client, 'describeSObjects').mockResolvedValue({
          result: [
            {
              name: 'obj',
              createable: false,
              updateable: true,
              deletable: true,
              fields: [
                {
                  name: 'Field__c',
                  updateable: true,
                  createable: true,
                  queryable: true,
                },
              ],
            } as unknown as DescribeSObjectResult,
          ],
          errors: [],
        })
        changeErrors = await customObjectInstancesValidator(changes)
      })
      it('should create change error for the added instance', () => {
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0]).toSatisfy(
          (e: ChangeError) => e.elemID.isEqual(addedInstance.elemID) && e.message === 'Cannot create records of type',
        )
      })
    })
    describe('when updateable is false', () => {
      beforeEach(async () => {
        jest.spyOn(client, 'describeSObjects').mockResolvedValue({
          result: [
            {
              name: 'obj',
              createable: true,
              updateable: false,
              deletable: true,
              fields: [
                {
                  name: 'Field__c',
                  updateable: true,
                  createable: true,
                  queryable: true,
                },
              ],
            } as unknown as DescribeSObjectResult,
          ],
          errors: [],
        })
        changeErrors = await customObjectInstancesValidator(changes)
      })
      it('should create change error for the modified instance', () => {
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0]).toSatisfy(
          (e: ChangeError) =>
            e.elemID.isEqual(modifiedInstance.elemID) && e.message === 'Cannot modify records of type',
        )
      })
    })
    describe('when deletable is false', () => {
      beforeEach(async () => {
        jest.spyOn(client, 'describeSObjects').mockResolvedValue({
          result: [
            {
              name: 'obj',
              createable: true,
              updateable: true,
              deletable: false,
              fields: [
                {
                  name: 'Field__c',
                  updateable: true,
                  createable: true,
                  queryable: true,
                },
              ],
            } as unknown as DescribeSObjectResult,
          ],
          errors: [],
        })
        changeErrors = await customObjectInstancesValidator(changes)
      })
      it('should create change error for the removed instance', () => {
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0]).toSatisfy(
          (e: ChangeError) => e.elemID.isEqual(removedInstance.elemID) && e.message === 'Cannot delete records of type',
        )
      })
    })
  })
})
