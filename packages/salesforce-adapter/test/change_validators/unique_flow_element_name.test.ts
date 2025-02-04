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
import { FLOW_METADATA_TYPE, FLOW_NODE_FIELD_NAMES } from '../../src/constants'

describe('uniqueFlowElementName change validator', () => {
  let flowChange: Change
  let flowElement: MetadataObjectType
  let flowNode: MetadataObjectType
  let flowElementWithNonUniqueName: MetadataObjectType
  let flow: MetadataObjectType
  let flowInstance: InstanceElement
  beforeEach(() => {
    flowElementWithNonUniqueName = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowMetadataValue',
      },
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    flowElement = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowConstant',
      },
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    flowNode = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowActionCall',
      },
      fields: {
        [FLOW_NODE_FIELD_NAMES.NAME]: { refType: BuiltinTypes.STRING },
        [FLOW_NODE_FIELD_NAMES.LOCATION_X]: { refType: BuiltinTypes.NUMBER, annotations: { constant: 1 } },
        [FLOW_NODE_FIELD_NAMES.LOCATION_Y]: { refType: BuiltinTypes.NUMBER, annotations: { constant: 1 } },
      },
    })
    flow = createMetadataObjectType({
      annotations: {
        metadataType: FLOW_METADATA_TYPE,
      },
      fields: {
        actionCalls: { refType: new ListType(flowNode), annotations: { required: false } },
        constants: { refType: new ListType(flowElement), annotations: { required: false } },
        decisions: { refType: new ListType(flowElement), annotations: { required: false } },
        dynamicChoiceSets: { refType: new ListType(flowElement), annotations: { required: false } },
        screens: { refType: new ListType(flowElement), annotations: { required: false } },
        processMetadataValues: {
          refType: new ListType(flowElementWithNonUniqueName),
          annotations: { required: false },
        },
      },
    })
  })
  describe('when all FlowElement names are unique', () => {
    beforeEach(() => {
      flowInstance = createInstanceElement(
        {
          fullName: 'TestFlow',
          actionCalls: [{ name: 'ActionCall1' }, { name: 'ActionCall2' }],
          constants: [{ name: 'Constant1' }, { name: 'Constant2' }],
          decisions: [{ name: 'Decision1' }],
          dynamicChoiceSets: [{ name: 'DynamicChoice1' }],
          screens: [{ name: 'Screen1' }],
          processMetadataValues: [{ name: 'Value1' }],
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
  describe('when there are duplicate FlowElement names', () => {
    beforeEach(() => {
      flowInstance = createInstanceElement(
        {
          fullName: 'TestFlow',
          // Flow element extending FlowNode. Should be checked for uniqueness.
          actionCalls: [{ name: 'duplicateName' }, { name: 'anotherDuplicateName' }],
          constants: [{ name: 'duplicateName' }, { name: 'duplicateName' }],
          decisions: [{ name: 'uniqueName' }, { name: 'ThirdDuplicateName' }],
          dynamicChoiceSets: [{ name: 'duplicateName' }],
          screens: [{ name: 'anotherDuplicateName' }, { name: 'anotherDuplicateName' }],
          // Flow element with a non-unique name. uniqueness check not required.
          processMetadataValues: [{ name: 'ThirdDuplicateName' }, { name: 'ThirdDuplicateName' }],
        },
        flow,
      )
      flowChange = toChange({ after: flowInstance })
    })
    it('should return change errors for duplicate names in FlowElements with unique name only', async () => {
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
        {
          elemID: flowInstance.elemID.createNestedID('actionCalls', '0', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "duplicateName" is used multiple times in this Flow.',
        },
        {
          elemID: flowInstance.elemID.createNestedID('actionCalls', '1', 'name'),
          severity: 'Warning',
          message: 'Duplicate Name in Flow',
          detailedMessage: 'The name "anotherDuplicateName" is used multiple times in this Flow.',
        },
      ]
      expect(errors).toIncludeSameMembers(expectedErrors)
    })
  })
})
