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
} from '@salto-io/adapter-api'
import changeValidatorCreator from '../../src/change_validators/custom_object_instances'
import { FIELD_ANNOTATIONS, METADATA_TYPE, CUSTOM_OBJECT, API_NAME } from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { getLookUpName } from '../../src/transformers/reference_mapping'
import mockClient from '../client'
import { SalesforceClient } from '../../index'

describe('custom object instances change validator', () => {
  let customObjectInstancesValidator: ChangeValidator
  let client: SalesforceClient
  const obj = new ObjectType({
    elemID: new ElemID('salesforce', 'obj'),
    fields: {
      nonUpdateable: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
        },
      },
      nonCreatable: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'obj__c',
    },
  })
  beforeEach(() => {
    client = mockClient().client
    customObjectInstancesValidator = changeValidatorCreator(getLookUpName(defaultFilterContext.fetchProfile), client)
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
      nonUpdateable: 'youCantUpdateMe',
      nonCreatable: 'youCanUpdateMe',
    })
    let after: InstanceElement

    beforeEach(() => {
      after = before.clone()
    })
    it('should have change error with warning when editing a non-updateable field', async () => {
      after.value.nonUpdateable = 'IamTryingToUpdate'
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
})
