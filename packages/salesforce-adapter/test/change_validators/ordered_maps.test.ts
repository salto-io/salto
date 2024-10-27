/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import changeValidatorCreator from '../../src/change_validators/ordered_maps'
import { METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { GLOBAL_VALUE_SET } from '../../src/filters/global_value_sets'
import { Types } from '../../src/transformers/transformer'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('OrderedMap Change Validator', () => {
  const changeValidator = changeValidatorCreator(
    buildFetchProfile({ fetchParams: { optionalFeatures: { picklistsAsMaps: true } } }),
  )
  describe('InstanceElement with ordered map', () => {
    const gvsType = new ObjectType({
      elemID: new ElemID(SALESFORCE, GLOBAL_VALUE_SET),
      annotations: { [METADATA_TYPE]: GLOBAL_VALUE_SET },
    })
    const gvs = new InstanceElement('MyGVS', gvsType, {
      customValue: {
        values: {
          val1: 'value1',
          val2: 'value2',
        },
      },
    })

    it('should return an error when the order field is missing', async () => {
      const errors = await changeValidator([toChange({ after: gvs })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: gvs.elemID,
        severity: 'Error',
        message: 'Missing field in ordered map',
        detailedMessage: 'Missing order or values fields in field customValue',
      })
    })

    it('should return an error when a field ref is missing', async () => {
      gvs.value.customValue.order = [
        new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
      ]
      const errors = await changeValidator([toChange({ after: gvs })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: gvs.elemID,
        severity: 'Error',
        message: 'Missing reference in ordered map',
        detailedMessage: 'Missing reference in field customValue.order: val2',
      })
    })

    it('should return an error when a ref is invalid', async () => {
      gvs.value.customValue.order = [
        new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
        new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val2')),
        'invalid',
      ]
      const errors = await changeValidator([toChange({ after: gvs })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: gvs.elemID,
        severity: 'Error',
        message: 'Invalid reference in ordered map',
        detailedMessage:
          'Invalid reference in field customValue.order: invalid. Only reference to internal value keys are allowed.',
      })
    })

    it('should return an error for duplicate field refs', async () => {
      gvs.value.customValue.order = [
        new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
        new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
        new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val2')),
      ]
      const errors = await changeValidator([toChange({ after: gvs })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: gvs.elemID,
        severity: 'Error',
        message: 'Duplicate reference in ordered map',
        detailedMessage: 'Duplicate reference in field customValue.order: val1',
      })
    })
  })

  describe('ObjectType with ordered map', () => {
    const account = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'Account'),
      fields: {
        CustomerPriority__c: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            valueSet: {
              values: {
                High: 'High',
                Low: 'Low',
              },
            },
          },
        },
      },
    })

    const fieldElemID = account.elemID.createNestedID('field', 'CustomerPriority__c')

    it('should return an error when the order field is missing', async () => {
      const errors = await changeValidator([toChange({ after: account })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: fieldElemID,
        severity: 'Error',
        message: 'Missing field in ordered map',
        detailedMessage: 'Missing order or values fields in field valueSet',
      })
    })

    it('should return an error when a field ref is missing', async () => {
      account.fields.CustomerPriority__c.annotations.valueSet.order = [
        new ReferenceExpression(fieldElemID.createNestedID('valueSet', 'values', 'High')),
      ]
      const errors = await changeValidator([toChange({ after: account })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: fieldElemID,
        severity: 'Error',
        message: 'Missing reference in ordered map',
        detailedMessage: 'Missing reference in field valueSet.order: Low',
      })
    })

    it('should return an error when a ref is invalid', async () => {
      account.fields.CustomerPriority__c.annotations.valueSet.order = [
        new ReferenceExpression(fieldElemID.createNestedID('valueSet', 'values', 'High')),
        new ReferenceExpression(fieldElemID.createNestedID('valueSet', 'values', 'Low')),
        'invalid',
      ]
      const errors = await changeValidator([toChange({ after: account })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: fieldElemID,
        severity: 'Error',
        message: 'Invalid reference in ordered map',
        detailedMessage:
          'Invalid reference in field valueSet.order: invalid. Only reference to internal value keys are allowed.',
      })
    })

    it('should return an error for duplicate field refs', async () => {
      account.fields.CustomerPriority__c.annotations.valueSet.order = [
        new ReferenceExpression(fieldElemID.createNestedID('valueSet', 'values', 'High')),
        new ReferenceExpression(fieldElemID.createNestedID('valueSet', 'values', 'High')),
        new ReferenceExpression(fieldElemID.createNestedID('valueSet', 'values', 'Low')),
      ]
      const errors = await changeValidator([toChange({ after: account })])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: fieldElemID,
        severity: 'Error',
        message: 'Duplicate reference in ordered map',
        detailedMessage: 'Duplicate reference in field valueSet.order: High',
      })
    })
  })
})
