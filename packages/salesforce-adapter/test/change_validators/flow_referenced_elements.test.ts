/*
 * Copyright 2024 Salto Labs Ltd.
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
import { TARGET_REFERENCE } from '../../src/constants'

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
        targetReference: { refType: BuiltinTypes.STRING },
      },
    })
    FlowNode = createMetadataObjectType({
      annotations: {
        metadataType: 'FlowNode',
      },
      fields: {
        name: { refType: BuiltinTypes.STRING },
        locationX: { refType: BuiltinTypes.NUMBER, annotations: { constant: 1 } },
        locationY: { refType: BuiltinTypes.NUMBER, annotations: { constant: 1 } },
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
            connector: { targetReference: 'ActionCall' },
          },
          actionCalls: [
            {
              name: 'ActionCall',
              connector: { targetReference: 'Assignment' },
            },
          ],
          assignments: [
            {
              name: 'Assignment',
              connector: { targetReference: 'Decision' },
            },
          ],
          decisions: [
            {
              name: 'Decision',
              connector: { targetReference: 'RecordCreate' },
            },
          ],
          recordCreates: [
            {
              name: 'RecordCreate',
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
            connector: { targetReference: 'ActionCall' },
          },
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should not return any errors', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toHaveLength(1)
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
              name: 'ActionCall',
            },
          ],
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should not return any errors', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toHaveLength(1)
      expect(errors).toEqual([
        {
          severity: 'Info',
          message: 'Unused Flow Element',
          detailedMessage: `The Flow Element "${'ActionCall'}" isn’t being used in the Flow.`,
          elemID: flow.elemID.createNestedID('actionCalls', '0', 'name'),
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
            connector: { targetReference: 'ActionCall' },
          },
          assignments: [
            {
              name: 'Assignment',
              connector: { targetReference: 'Decision' },
            },
          ],
          decisions: [
            {
              name: 'Decision',
              connector: { targetReference: 'RecordCreate' },
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
          elemID: flow.elemID.createNestedID('assignments', '0', 'name'),
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
            connector: { targetReference: 'Assignment' },
          },
          assignments: [
            {
              name: 'Assignment',
              connector: { targetReference: 'ActionCall' },
            },
          ],
          decisions: [
            {
              name: 'Decision',
              connector: { targetReference: 'ActionCall' },
            },
          ],
        },
        Flow,
      )
      flowChange = toChange({ after: flow })
    })
    it('should create change error per reference', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors[1]).toEqual({
        severity: 'Error',
        message: 'Reference to missing Flow Element',
        detailedMessage: `The Flow Element "${'ActionCall'}" does not exist.`,
        elemID: flow.elemID.createNestedID('assignments', '0', 'connector', TARGET_REFERENCE),
      })
      expect(errors[2]).toEqual({
        severity: 'Error',
        message: 'Reference to missing Flow Element',
        detailedMessage: `The Flow Element "${'ActionCall'}" does not exist.`,
        elemID: flow.elemID.createNestedID('decisions', '0', 'connector', TARGET_REFERENCE),
      })
    })
  })
})
