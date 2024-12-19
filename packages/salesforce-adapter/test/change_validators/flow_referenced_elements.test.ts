/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, Change, ListType, toChange } from '@salto-io/adapter-api'
import flowReferencedElements from '../../src/change_validators/flow_referenced_elements'
import { createInstanceElement, createMetadataObjectType } from '../../src/transformers/transformer'

describe('flowReferencedElements change validator', () => {
  let flowChange: Change
  const FlowConnector = createMetadataObjectType({
    annotations: {
      metadataType: 'FlowConnector',
    },
    fields: {
      targetReference: { refType: BuiltinTypes.STRING },
    },
  })
  const FlowNode = createMetadataObjectType({
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
  const Flow = createMetadataObjectType({
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
      expect(errors).toHaveLength(0)
    })
  })
  describe('when there are references to missing flow elements', () => {
    beforeEach(() => {
      const flow = createInstanceElement(
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
      const [error] = errors
      expect(error.severity).toEqual('Error')
      expect(error.message).toEqual('Reference to missing Flow Element')
      expect(error.detailedMessage).toEqual(`The Flow Element "${'ActionCall'}" does not exist.`)
    })
  })
  describe('when there are flow elements that are  not referenced', () => {
    beforeEach(() => {
      const flow = createInstanceElement(
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
      const [error] = errors
      expect(error.severity).toEqual('Info')
      expect(error.message).toEqual('Unused Flow Element')
      expect(error.detailedMessage).toEqual(`The Flow Element “${'ActionCall'}” isn’t being used in the Flow.`)
    })
  })
  describe('when there are multiple errors in one flow', () => {
    beforeEach(() => {
      const flow = createInstanceElement(
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
    it('should create change error per error', async () => {
      const errors = await flowReferencedElements([flowChange])
      expect(errors).toHaveLength(3)
    })
  })
})
