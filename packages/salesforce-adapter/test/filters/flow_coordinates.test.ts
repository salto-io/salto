/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  Change,
  Element,
  getChangeData,
  InstanceElement,
  ListType,
  toChange,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/flow_coordinates'
import { defaultFilterContext } from '../utils'
import { createMetadataObjectType } from '../../src/transformers/transformer'
import { FLOW_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'
import { FilterWith } from './mocks'

const flowAssignmentType = createMetadataObjectType({
  annotations: {
    [METADATA_TYPE]: 'FlowAssignment',
  },
  fields: {
    label: { refType: BuiltinTypes.STRING },
    locationX: { refType: BuiltinTypes.NUMBER },
    locationY: { refType: BuiltinTypes.NUMBER },
  },
})

const unrelatedTypeWithCoordinates = createMetadataObjectType({
  annotations: {
    [METADATA_TYPE]: 'UnrelatedType',
  },
  fields: {
    locationX: { refType: BuiltinTypes.NUMBER },
    locationY: { refType: BuiltinTypes.NUMBER },
  },
})

const flowElementReferenceOrValue = createMetadataObjectType({
  annotations: {
    [METADATA_TYPE]: 'FlowElementReferenceOrValue',
  },
  fields: {
    stringValue: { refType: BuiltinTypes.STRING },
  },
})

const flowMetadataValueType = createMetadataObjectType({
  annotations: {
    [METADATA_TYPE]: 'FlowMetadataValue',
  },
  fields: {
    name: { refType: BuiltinTypes.STRING },
    value: { refType: flowElementReferenceOrValue },
  },
})

const flowType = createMetadataObjectType({
  annotations: {
    [METADATA_TYPE]: FLOW_METADATA_TYPE,
  },
  fields: {
    assignments: {
      refType: new ListType(flowAssignmentType),
    },
    processMetadataValues: {
      refType: new ListType(flowMetadataValueType),
    },
    irrelevantField: {
      refType: unrelatedTypeWithCoordinates,
    },
  },
})

describe('flow coordinates filter', () => {
  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  describe('onFetch', () => {
    let elements: Element[]
    describe('when the type has the right fields but is not a flow', () => {
      const objectType = createMetadataObjectType({
        annotations: {
          [METADATA_TYPE]: 'TestType',
        },
        fields: {
          assignment: {
            refType: flowAssignmentType,
          },
        },
      })
      const instance = new InstanceElement('SomeInstance', objectType, {
        assignments: [
          {
            locationX: 1,
            locationY: 2,
          },
        ],
      })

      beforeEach(async () => {
        elements = [instance].map(e => e.clone())
        await filter.onFetch(elements)
      })

      it('should not modify anything', () => {
        expect((elements[0] as InstanceElement).value).toHaveProperty('assignments', instance.value.assignments)
      })
    })
    describe('when a field of flow has the right fields but is not of a known type', () => {
      const instance = new InstanceElement('SomeInstance', flowType, {
        irrelevantField: {
          locationX: 1,
          locationY: 2,
        },
      })

      beforeEach(async () => {
        elements = [instance].map(e => e.clone())
        await filter.onFetch(elements)
      })

      it('should not modify anything', () => {
        expect((elements[0] as InstanceElement).value).toHaveProperty('irrelevantField', { locationX: 1, locationY: 2 })
      })
    })
    describe('when a flow is not in auto-layout mode', () => {
      const instance = new InstanceElement('flowInstance', flowType, {
        assignments: [
          {
            label: 'SomeLabel',
            locationX: 1,
            locationY: 2,
          },
        ],
        processMetadataValues: [
          {
            name: 'CanvasMode',
            value: {
              stringValue: 'FREE_FORM_CANVAS',
            },
          },
        ],
      })

      beforeEach(async () => {
        elements = [instance].map(e => e.clone())
        await filter.onFetch(elements)
      })

      it('should not modify anything', () => {
        expect((elements[0] as InstanceElement).value).toHaveProperty('assignments', instance.value.assignments)
      })
    })
    describe('when a flow is in auto-layout mode', () => {
      const instance = new InstanceElement('flowInstance', flowType, {
        assignments: [
          {
            label: 'SomeAssignment',
            locationX: 1,
            locationY: 2,
          },
        ],
        processMetadataValues: [
          {
            name: 'CanvasMode',
            value: {
              stringValue: 'AUTO_LAYOUT_CANVAS',
            },
          },
        ],
      })

      beforeEach(async () => {
        elements = [instance].map(e => e.clone())
        await filter.onFetch(elements)
      })

      it('should remove the coordinate fields', () => {
        expect((elements[0] as InstanceElement).value.assignments[0]).not.toHaveProperty('locationX')
        expect((elements[0] as InstanceElement).value.assignments[0]).not.toHaveProperty('locationX')
      })
    })
  })
  describe('preDeploy', () => {
    let changes: Change[]
    describe('when the type has the right fields but is not a flow', () => {
      const objectType = createMetadataObjectType({
        annotations: {
          [METADATA_TYPE]: 'TestType',
        },
        fields: {
          assignment: {
            refType: flowAssignmentType,
          },
        },
      })
      const instance = new InstanceElement('SomeInstance', objectType, {
        assignments: [
          {
            label: 'SomeLabel',
          },
        ],
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.preDeploy(changes)
      })

      it('should not modify anything', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty(
          'assignments',
          instance.value.assignments,
        )
      })
    })
    describe('when a field of flow has the right fields but is not of a known type', () => {
      const instance = new InstanceElement('SomeInstance', flowType, {
        irrelevantField: {
          label: 'SomeLabel',
        },
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.preDeploy(changes)
      })

      it('should not modify anything', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty(
          'irrelevantField',
          instance.value.irrelevantField,
        )
      })
    })
    describe('when deploying a flow with fields of a known type', () => {
      const instance = new InstanceElement('flowInstance', flowType, {
        assignments: [
          {
            label: 'SomeLabel',
          },
        ],
        processMetadataValues: [
          {
            name: 'CanvasMode',
            value: {
              stringValue: 'FREE_FORM_CANVAS',
            },
          },
        ],
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.preDeploy(changes)
      })

      it('should add coordinate values', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty('assignments', [
          {
            label: 'SomeLabel',
            locationX: 0,
            locationY: 0,
          },
        ])
      })
    })
  })
  describe('onDeploy', () => {
    let changes: Change[]
    describe('when the type has the right fields but is not a flow', () => {
      const objectType = createMetadataObjectType({
        annotations: {
          [METADATA_TYPE]: 'TestType',
        },
        fields: {
          assignment: {
            refType: flowAssignmentType,
          },
        },
      })
      const instance = new InstanceElement('SomeInstance', objectType, {
        assignments: [
          {
            locationX: 1,
            locationY: 2,
          },
        ],
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.onDeploy(changes)
      })

      it('should not modify anything', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty(
          'assignments',
          instance.value.assignments,
        )
      })
    })
    describe('when a field of flow has the right fields but is not of a known type', () => {
      const instance = new InstanceElement('SomeInstance', flowType, {
        irrelevantField: {
          locationX: 1,
          locationY: 2,
        },
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.onDeploy(changes)
      })

      it('should not modify anything', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty(
          'irrelevantField',
          instance.value.irrelevantField,
        )
      })
    })
    describe('when a flow is not in auto-layout mode', () => {
      const instance = new InstanceElement('flowInstance', flowType, {
        assignments: [
          {
            label: 'SomeLabel',
            locationX: 1,
            locationY: 2,
          },
        ],
        processMetadataValues: [
          {
            name: 'CanvasMode',
            value: {
              stringValue: 'FREE_FORM_CANVAS',
            },
          },
        ],
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.onDeploy(changes)
      })

      it('should not modify anything', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty(
          'assignments',
          instance.value.assignments,
        )
      })
    })
    describe('when a flow is in auto-layout mode with zero coordinates', () => {
      const instance = new InstanceElement('flowInstance', flowType, {
        assignments: [
          {
            label: 'SomeAssignment',
            locationX: 0,
            locationY: 0,
          },
        ],
        processMetadataValues: [
          {
            name: 'CanvasMode',
            value: {
              stringValue: 'AUTO_LAYOUT_CANVAS',
            },
          },
        ],
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.onDeploy(changes)
      })

      it('should remove the coordinate fields', () => {
        const instanceAfterTest = getChangeData(changes[0]) as InstanceElement
        expect(instanceAfterTest.value.assignments[0]).not.toHaveProperty('locationX')
        expect(instanceAfterTest.value.assignments[0]).not.toHaveProperty('locationX')
      })
    })
    describe('when a flow is in auto-layout mode with nonzero coordinates', () => {
      const instance = new InstanceElement('flowInstance', flowType, {
        assignments: [
          {
            label: 'SomeAssignment',
            locationX: 123,
            locationY: 456,
          },
        ],
        processMetadataValues: [
          {
            name: 'CanvasMode',
            value: {
              stringValue: 'AUTO_LAYOUT_CANVAS',
            },
          },
        ],
      })

      beforeEach(async () => {
        changes = [instance].map(e => toChange({ after: e.clone() }))
        await filter.onDeploy(changes)
      })

      it('should not modify anything', () => {
        expect((getChangeData(changes[0]) as InstanceElement).value).toHaveProperty(
          'assignments',
          instance.value.assignments,
        )
      })
    })
  })
})
