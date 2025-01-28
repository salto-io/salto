/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, Change, InstanceElement, ListType, toChange } from '@salto-io/adapter-api'
import { createInstanceElement, createMetadataObjectType, MetadataObjectType } from '../../src/transformers/transformer'
import uniqueFlowElementName from '../../src/change_validators/unique_flow_element_name'
import { FLOW_METADATA_TYPE } from '../../src/constants'

describe('uniqueFlowElementName change validator', () => {
  let flowChange: Change
  let FlowElement: MetadataObjectType
  let flow: MetadataObjectType
  let flowInstance: InstanceElement
  beforeEach(() => {
    FlowElement = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowConstant',
      },
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    flow = createMetadataObjectType({
      annotations: {
        metadataType: FLOW_METADATA_TYPE,
      },
      fields: {
        constants: { refType: new ListType(FlowElement), annotations: { required: false } },
        decisions: { refType: new ListType(FlowElement), annotations: { required: false } },
        dynamicChoiceSets: { refType: new ListType(FlowElement), annotations: { required: false } },
        screens: { refType: new ListType(FlowElement), annotations: { required: false } },
      },
    })
  })
  describe('when all FlowElement names are unique', () => {
    beforeEach(() => {
      flowInstance = createInstanceElement(
        {
          fullName: 'TestFlow',
          constants: [{ name: 'constant1' }, { name: 'constant2' }],
          decisions: [{ name: 'decision1' }],
          dynamicChoiceSets: [{ name: 'dynamicChoice1' }],
          screens: [{ name: 'screen1' }],
        },
        flow,
      )
      flowChange = toChange({ after: flowInstance })
    })
    it('should return no change errors', async () => {
      const errors = await uniqueFlowElementName([flowChange])
      expect(errors).toBeEmpty()
    })
  })
  describe('when there duplicate FlowElement names', () => {
    beforeEach(() => {
      flowInstance = createInstanceElement(
        {
          fullName: 'TestFlow',
          constants: [{ name: 'duplicateName' }, { name: 'duplicateName' }],
          decisions: [{ name: 'uniqueName' }],
          dynamicChoiceSets: [{ name: 'duplicateName' }],
          screens: [{ name: 'anotherDuplicateName' }, { name: 'anotherDuplicateName' }],
        },
        flow,
      )
      flowChange = toChange({ after: flowInstance })
    })
    it('should return change errors for duplicate names', async () => {
      const errors = await uniqueFlowElementName([flowChange])
      const expectedErrors = [
        {
          elemID: flowInstance.elemID.createNestedID('constants', '0', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "duplicateName" is used multiple times in this Flow.',
        },
        {
          elemID: flowInstance.elemID.createNestedID('constants', '1', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "duplicateName" is used multiple times in this Flow.',
        },
        {
          elemID: flowInstance.elemID.createNestedID('dynamicChoiceSets', '0', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "duplicateName" is used multiple times in this Flow.',
        },
        {
          elemID: flowInstance.elemID.createNestedID('screens', '0', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "anotherDuplicateName" is used multiple times in this Flow.',
        },
        {
          elemID: flowInstance.elemID.createNestedID('screens', '1', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "anotherDuplicateName" is used multiple times in this Flow.',
        },
      ]
      expect(errors).toEqual(expectedErrors)
    })
  })
})
