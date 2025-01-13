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
  Element,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import * as constants from '../../src/constants'
import filterCreator, { GLOBAL_VALUE_SET, CUSTOM_VALUE, MASTER_LABEL } from '../../src/filters/global_value_sets'
import { Types } from '../../src/transformers/transformer'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

const createGlobalValueSetInstanceElement = (name: string, values: string[]): InstanceElement =>
  new InstanceElement(
    'global_value_set_test',
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, 'global_value_set'),
      annotationRefsOrTypes: {},
      annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET },
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: name,
      [MASTER_LABEL]: name,
      [constants.DESCRIPTION]: name,
      sorted: false,
      [CUSTOM_VALUE]: values.map(v => ({
        [constants.CUSTOM_VALUE.FULL_NAME]: v,
        [constants.CUSTOM_VALUE.DEFAULT]: false,
        [constants.CUSTOM_VALUE.LABEL]: v,
        [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
      })),
    },
  )

const createPicklistObjectType = (mockElemID: ElemID, apiName: string, valueSetName: string): ObjectType =>
  new ObjectType({
    elemID: mockElemID,
    fields: {
      state: {
        refType: Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.API_NAME]: apiName,
          label: 'test label',
          [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: valueSetName,
          [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
        },
      },
      regular: {
        refType: Types.primitiveDataTypes.Number,
        annotations: {
          [constants.API_NAME]: 'Test__c.regular__c',
        },
      },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      [constants.API_NAME]: 'Test__c',
    },
  })

describe('Global Value Sets filter', () => {
  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  let elements: Element[] = []

  beforeEach(() => {
    elements = [createGlobalValueSetInstanceElement('test1', ['val1', 'val2'])]
  })

  describe('on fetch', () => {
    it('should replace value set with references', async () => {
      elements.push(createPicklistObjectType(mockElemID, 'test', 'test1'))
      await filter.onFetch(elements)
      const globalValueSetInstance = elements[0] as InstanceElement
      const customObjectType = elements[1] as ObjectType
      expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(
        new ReferenceExpression(globalValueSetInstance.elemID, globalValueSetInstance),
      )
    })

    it('should not replace value set with references if value set name does not exist', async () => {
      elements.push(createPicklistObjectType(mockElemID, 'test', 'not_exist'))
      await filter.onFetch(elements)
      const customObjectType = elements[1] as ObjectType
      expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual('not_exist')
    })
  })
})
