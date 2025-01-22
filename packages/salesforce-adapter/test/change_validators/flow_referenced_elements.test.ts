/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, Change, ListType, toChange } from '@salto-io/adapter-api'
import flowReferencedElements from '../../src/change_validators/flow_referenced_elements'
import {
  createInstanceElement,
  createMetadataObjectType,
  MetadataInstanceElement,
  MetadataObjectType,
} from '../../src/transformers/transformer'
import { FLOW_NODE_FIELD_NAMES, TARGET_REFERENCE } from '../../src/constants'

describe('flowReferencedElements change validator', () => {
  let flowChange: Change
  let FlowConnector: MetadataObjectType
  let FlowNode: MetadataObjectType
  let Flow: MetadataObjectType
  beforeEach(() => {
    FlowConnector = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowConnector',
      },
      fields: {
        [TARGET_REFERENCE]: { refType: BuiltinTypes.STRING },
      },
    })
    FlowNode = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowNode',
      },
      fields: {
        [FLOW_NODE_FIELD_NAMES.NAME]: { refType: BuiltinTypes.STRING },
        [FLOW_NODE_FIELD_NAMES.LOCATION_X]: { refType: BuiltinTypes.NUMBER, annotations: { constant: 1 } },
        [FLOW_NODE_FIELD_NAMES.LOCATION_Y]: { refType: BuiltinTypes.NUMBER, annotations: { constant: 1 } },
        connector: { refType: FlowConnector, annotations: { required: false } },
      },
    })
    Flow = createMetadataObjectType({
      annotations: {
        metadataType: 'Flow',
      },
      fields: {
        start: { refType: FlowNode },
        actionCalls: { refType: new ListType(FlowNode), annotations: { required: false } },
        assignments: { refType: new ListType(FlowNode), annotations: { required: false } },
        decisions: { refType: new ListType(FlowNode), annotations: { required: false } },
        recordCreates: { refType: new ListType(FlowNode), annotations: { required: false } },
      },
    })
  })
  describe('when all flow elements are existing and referenced', () => {
    beforeEach(() => {
      const flow = createInstanceElement(
        {
          fullName: 'TestFlow',
          start: {
            connector: { [TARGET_REFERENCE]: 'ActionCall' },
          },
          actionCalls: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'ActionCall',
              connector: { [TARGET_REFERENCE]: 'Assignment' },
            },
          ],
          assignments: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'Assignment',
              connector: { [TARGET_REFERENCE]: 'Decision' },
            },
          ],
          decisions: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'Decision',
              connector: { [TARGET_REFERENCE]: 'RecordCreate' },
            },
          ],
          recordCreates: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'RecordCreate',
            },
          ],
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should not return any errors', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toBeEmpty()
    })
  })
  describe('when there are references to missing flow elements', () => {
    let flow: MetadataInstanceElement
    beforeEach(() => {
      flow = createInstanceElement(
        {
          fullName: 'TestFlow',
          start: {
            connector: { [TARGET_REFERENCE]: 'ActionCall' },
          },
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should not return any errors', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toEqual([
        {
          severity: 'Error',
          message: 'Reference to missing Flow Element',
          detailedMessage: `The Flow Element "${'ActionCall'}" does not exist.`,
          elemID: flow.elemID.createNestedID('start', 'connector', TARGET_REFERENCE),
        },
      ])
    })
  })
  describe('when there are flow elements that are  not referenced', () => {
    let flow: MetadataInstanceElement
    beforeEach(() => {
      flow = createInstanceElement(
        {
          fullName: 'TestFlow',
          actionCalls: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'ActionCall',
            },
          ],
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should not return any errors', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toEqual([
        {
          severity: 'Info',
          message: 'Unused Flow Element',
          detailedMessage: `The Flow Element "${'ActionCall'}" isn’t being used in the Flow.`,
          elemID: flow.elemID.createNestedID('actionCalls', '0', FLOW_NODE_FIELD_NAMES.NAME),
        },
      ])
    })
  })
  describe('when there are multiple errors in one flow', () => {
    let flow: MetadataInstanceElement
    beforeEach(() => {
      flow = createInstanceElement(
        {
          fullName: 'TestFlow',
          start: {
            connector: { [TARGET_REFERENCE]: 'ActionCall' },
          },
          assignments: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'Assignment',
              connector: { [TARGET_REFERENCE]: 'Decision' },
            },
          ],
          decisions: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'Decision',
              connector: { [TARGET_REFERENCE]: 'RecordCreate' },
            },
          ],
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should create change error per issue', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toEqual([
        {
          severity: 'Info',
          message: 'Unused Flow Element',
          detailedMessage: `The Flow Element "${'Assignment'}" isn’t being used in the Flow.`,
          elemID: flow.elemID.createNestedID('assignments', '0', FLOW_NODE_FIELD_NAMES.NAME),
        },
        {
          severity: 'Error',
          message: 'Reference to missing Flow Element',
          detailedMessage: `The Flow Element "${'ActionCall'}" does not exist.`,
          elemID: flow.elemID.createNestedID('start', 'connector', TARGET_REFERENCE),
        },
        {
          severity: 'Error',
          message: 'Reference to missing Flow Element',
          detailedMessage: `The Flow Element "${'RecordCreate'}" does not exist.`,
          elemID: flow.elemID.createNestedID('decisions', '0', 'connector', TARGET_REFERENCE),
        },
      ])
    })
  })
  describe('when there are multiple missing references to the same element in one flow', () => {
    let flow: MetadataInstanceElement
    beforeEach(() => {
      flow = createInstanceElement(
        {
          fullName: 'TestFlow',
          start: {
            connector: { [TARGET_REFERENCE]: 'Assignment' },
          },
          assignments: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'Assignment',
              connector: { [TARGET_REFERENCE]: 'ActionCall' },
            },
          ],
          decisions: [
            {
              [FLOW_NODE_FIELD_NAMES.NAME]: 'Decision',
              connector: { [TARGET_REFERENCE]: 'ActionCall' },
            },
          ],
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should create change error per reference', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toIncludeSameMembers([
        {
          severity: 'Error',
          message: 'Reference to missing Flow Element',
          detailedMessage: `The Flow Element "${'ActionCall'}" does not exist.`,
          elemID: flow.elemID.createNestedID('assignments', '0', 'connector', TARGET_REFERENCE),
        },
        {
          severity: 'Error',
          message: 'Reference to missing Flow Element',
          detailedMessage: `The Flow Element "${'ActionCall'}" does not exist.`,
          elemID: flow.elemID.createNestedID('decisions', '0', 'connector', TARGET_REFERENCE),
        },
        {
          severity: 'Info',
          message: 'Unused Flow Element',
          detailedMessage: `The Flow Element "${'Decision'}" isn’t being used in the Flow.`,
          elemID: flow.elemID.createNestedID('decisions', '0', FLOW_NODE_FIELD_NAMES.NAME),
        },
      ])
    })
  })
})
