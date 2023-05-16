/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  AdditionChange,
  Change, ElemID,
  Field,
  getChangeData, isAdditionChange,
  isFieldChange,
  isModificationChange, isRemovalChange,
  ModificationChange,
  ObjectType, ReferenceExpression, RemovalChange,
  toChange,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/history_tracking'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { Types } from '../../src/transformers/transformer'
import {
  API_NAME,
  FIELD_ANNOTATIONS,
  HISTORY_TRACKED_FIELDS,
  OBJECT_HISTORY_TRACKING_ENABLED, SALESFORCE,
} from '../../src/constants'
import { FilterWith } from './mocks'

describe('historyTracking', () => {
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  const createField = (parentType: ObjectType, fieldName: string): Field => (
    new Field(parentType, fieldName, Types.primitiveDataTypes.Text, {
      [API_NAME]: `${parentType.elemID.typeName}.${fieldName}`,
    })
  )

  beforeEach(() => {
    filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })

  describe('onFetch', () => {
    describe('When fetching an object that does not support history tracking', () => {
      it('Should not modify the object', async () => {
        const inputType = mockTypes.Account.clone()
        const expectedOutput = inputType.clone()
        const elements = [inputType]
        await filter.onFetch(elements)
        expect(elements).toEqual([expectedOutput])
      })
    })
    describe('When fetching an object with history tracking disabled', () => {
      let inputType: ObjectType
      beforeEach(async () => {
        inputType = mockTypes.Account.clone()
        inputType.annotations.enableHistory = false
        Object.values(inputType.fields)
          .forEach(fieldDef => { fieldDef.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false })
        await filter.onFetch([inputType])
      })
      it('Should not add object-level trackedFields annotation', () => {
        expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('Should remove field-level annotation', () => {
        Object.values(inputType.fields)
          .forEach(field => expect(field.annotations).not.toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY))
      })
    })
    describe('When fetching an object with history tracking enabled', () => {
      const typeWithHistoryTrackedFields = createCustomObjectType('TypeWithHistoryTracking', {
        annotations: {
          [OBJECT_HISTORY_TRACKING_ENABLED]: true,
        },
        fields: {
          fieldWithHistoryTracking: {
            refType: Types.primitiveDataTypes.Text,
            annotations: {
              apiName: 'fieldWithHistoryTracking',
              [FIELD_ANNOTATIONS.TRACK_HISTORY]: true,
            },
          },
          fieldWithoutHistoryTracking: {
            refType: Types.primitiveDataTypes.Text,
            annotations: {
              apiName: 'fieldWithoutHistoryTracking',
              [FIELD_ANNOTATIONS.TRACK_HISTORY]: false,
            },
          },
        },
      })
      const referenceForField = (fieldName: string): ReferenceExpression => (
        new ReferenceExpression(typeWithHistoryTrackedFields.elemID.createNestedID('field', fieldName))
      )
      it('Should update the object and field annotations correctly', async () => {
        const elements = [typeWithHistoryTrackedFields.clone()]
        await filter.onFetch(elements)
        const trackedFieldNames = elements[0].annotations[HISTORY_TRACKED_FIELDS]
        expect(trackedFieldNames).toBeDefined()
        expect(trackedFieldNames).toEqual({
          fieldWithHistoryTracking: referenceForField('fieldWithHistoryTracking'),
        })
        expect(elements[0].fields.fieldWithHistoryTracking.annotations)
          .not
          .toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY)
        expect(elements[0].fields.fieldWithoutHistoryTracking.annotations)
          .not
          .toHaveProperty([FIELD_ANNOTATIONS.TRACK_HISTORY])
        expect(elements[0].annotations)
          .toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
      })
    })
  })
  describe('preDeploy', () => {
    const typeForPreDeploy = (trackedFields?: string[], fields: string[] = []): ObjectType => {
      const fieldApiName = (typeName: string, fieldName: string): string => `${typeName}.${fieldName}`
      const refExprForField = (typeName: string, fieldName: string): ReferenceExpression => (
        new ReferenceExpression(new ElemID(SALESFORCE, typeName, 'field', fieldName))
      )

      const typeName = 'SomeType__c'
      const objectType = createCustomObjectType(typeName, {
        annotations: {
          [OBJECT_HISTORY_TRACKING_ENABLED]: (trackedFields !== undefined),
        },
        fields: Object.fromEntries(fields.map(fieldName => [fieldName, {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            apiName: fieldApiName(typeName, fieldName),
          },
        }])),
      })
      if (trackedFields !== undefined) {
        objectType.annotations[HISTORY_TRACKED_FIELDS] = Object.fromEntries(trackedFields
          .map(fieldName => [fieldName, refExprForField(typeName, fieldName)]))
      }
      return objectType
    }

    describe('when an object does not support history tracking', () => {
      it('should not create any annotations', async () => {
        const objectType = createCustomObjectType('SomeObject', {
          fields: {
            SomeField: {
              refType: Types.primitiveDataTypes.Text,
              annotations: {
                apiName: 'SomeObject.SomeField',
              },
            },
          },
        })

        const changes = [toChange({ after: objectType })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED)
        expect(getChangeData(changes[0]).fields.SomeField).not.toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY)
      })
    })

    describe('when an object has no historyTrackedFields', () => {
      it('should add enableHistory=false annotation if the object type is new', async () => {
        const changes = [toChange({ after: typeForPreDeploy() })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, false)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('should add enableHistory=false annotation if the change is not related to history tracking', async () => {
        const before = typeForPreDeploy()
        before.annotations.unrelatedAnnotation = 'Something'
        const changes = [toChange({ before, after: typeForPreDeploy() })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, false)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('should add enableHistory=false annotation if historyTrackedFields was removed', async () => {
        const changes = [toChange({ before: typeForPreDeploy([]), after: typeForPreDeploy() })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, false)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
    })

    describe('when an object type has a historyTrackedFields annotation', () => {
      it('should add the enableHistory annotation if the object type is new', async () => {
        const changes = [toChange({ after: typeForPreDeploy([]) })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('should add the trackHistory annotation to fields if the object type is new', async () => {
        const changes = [toChange({ after: typeForPreDeploy(['SomeField'], ['SomeField', 'UntrackedField']) })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
        expect(getChangeData(changes[0]).fields.SomeField.annotations).toHaveProperty('trackHistory', true)
      })
      it('should add the enableHistory annotation if historyTrackedFields was modified', async () => {
        const before = typeForPreDeploy(['SomeField'], ['SomeField'])
        const changes = [toChange({ before, after: typeForPreDeploy([]) })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('should add the enableHistory annotation if historyTrackedFields was added', async () => {
        const changes = [toChange({ before: typeForPreDeploy(), after: typeForPreDeploy([]) })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('should ignore unknown field names in the annotation', async () => {
        const changes = [toChange({ before: typeForPreDeploy(), after: typeForPreDeploy(['Garbage']) })]
        await filter.preDeploy(changes)
        expect(changes).toHaveLength(1)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
    })

    describe('when fields belong to an object that has history tracking disabled', () => {
      const field = createField(typeForPreDeploy(), 'SomeField')

      it('should add \'trackHistory=false\' if the field was modified', async () => {
        const after = field.clone()
        after.annotations.someAnnotation = true
        const changes = [toChange({ before: field, after })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false)
      })
      it('should add \'trackHistory=false\' if the field was added', async () => {
        const after = field.clone()
        const changes = [toChange({ after })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false)
      })
    })

    describe('when fields belong to an object that has history tracking enabled', () => {
      describe('when the field is not tracked', () => {
        const parentType = typeForPreDeploy(['NotMyField'])
        const field = createField(parentType, 'SomeField')

        it('should add trackHistory=false annotation if the field was modified', async () => {
          const after = field.clone()
          after.annotations.someAnnotation = true
          const changes = [toChange({ before: field, after })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false)
        })
        it('should add trackHistory=false annotation if the field was added', async () => {
          const changes = [toChange({ after: field.clone() })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false)
        })
      })
      describe('when the field is tracked', () => {
        const parentType = typeForPreDeploy(['SomeField'], ['SomeField'])
        const field = createField(parentType, 'SomeField')

        it('should add trackHistory=true annotation if the field was modified', async () => {
          const after = field.clone()
          after.annotations.someAnnotation = true
          const changes = [toChange({ before: field, after })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, true)
        })
        it('should add trackHistory=true annotation if the field was added', async () => {
          const changes = [toChange({ after: field.clone() })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, true)
        })
      })
    })
    describe('When tracked fields are changed but there are no explicit changes to the fields themselves', () => {
      const isFieldModificationChange = <T extends Change<unknown>>(change: T)
        : change is T & ModificationChange<Field> => (
          isFieldChange(change) && isModificationChange(change)
        )
      const expectFieldTrackingChange = (change: Change, isRemoval: boolean): void => {
        expect(isFieldModificationChange(change)).toBeTrue()
        if (!isModificationChange(change)) {
          return // just to make the compiler aware
        }
        expect(change.data.before.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, isRemoval)
        expect(change.data.after.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, !isRemoval)
      }
      describe('When fields are added', () => {
        const expectFieldTrackingAdditionChange = (change: Change): void => expectFieldTrackingChange(change, false)
        it('should create new changes for newly tracked fields that existed before', async () => {
          const before = typeForPreDeploy([], ['SomeField'])
          const after = typeForPreDeploy(['SomeField'], ['SomeField'])
          const changes = [toChange({ before, after })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(2)
          expectFieldTrackingAdditionChange(changes[1])
        })

        it('should not create new changes for newly tracked fields that are created', async () => {
          const before = typeForPreDeploy([], [])
          const after = typeForPreDeploy(['SomeField'], ['SomeField'])
          const changes = [toChange({ before, after }), toChange({ after: after.fields.SomeField })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(2)
        })
        it('should create changes if the object\'s history tracking is enabled', async () => {
          const before = typeForPreDeploy(undefined, ['SomeField'])
          const after = typeForPreDeploy(['SomeField'], ['SomeField'])
          const changes = [toChange({ before, after })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(2)
          expectFieldTrackingAdditionChange(changes[1])
        })
      })

      describe('When fields are removed', () => {
        const expectFieldTrackingRemovalChange = (change: Change): void => expectFieldTrackingChange(change, true)

        it('should create new changes for removed fields that still exist', async () => {
          const before = typeForPreDeploy(['SomeField'], ['SomeField'])
          const after = typeForPreDeploy([], ['SomeField'])
          const changes = [toChange({ before, after })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(2)
          expectFieldTrackingRemovalChange(changes[1])
        })
        it('should not create new changes for fields that are no longer tracked because they no longer exist', async () => {
          const before = typeForPreDeploy(['SomeField'], ['SomeField'])
          const after = typeForPreDeploy([], [])
          const changes = [toChange({ before, after })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(1)
        })
        it('should create changes if the object\'s history tracking is disabled [SALTO-3378]', async () => {
          const before = typeForPreDeploy(['SomeField'], ['SomeField'])
          const after = typeForPreDeploy(undefined, ['SomeField'])
          const changes = [toChange({ before, after })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(2)
          expectFieldTrackingRemovalChange(changes[1])
        })
      })
    })
  })
  describe('onDeploy', () => {
    it('Should handle unrelated field changes', async () => {
      const field = createField(mockTypes.Account, 'SomeField')
      const expected = field.clone()
      const changes = [
        toChange({ before: field }),
        toChange({ after: field }),
        toChange({ before: field, after: field.clone() }),
      ]
      getChangeData(changes[2]).annotations.unrelatedAnnotation = 'Something'
      await filter.onDeploy(changes)
      expect(isRemovalChange(changes[0])).toBeTrue()
      expect((changes[0] as RemovalChange<Field>).data.before).toEqual(expected)
      expect(isAdditionChange(changes[1])).toBeTrue()
      expect((changes[1] as AdditionChange<Field>).data.after).toEqual(expected)
      expect(isModificationChange(changes[2])).toBeTrue()
      expect((changes[2] as ModificationChange<Field>).data.before).toEqual(expected)
      expect((changes[2] as ModificationChange<Field>).data.after.annotations).toHaveProperty('unrelatedAnnotation', 'Something')
    })
  })
  describe('End to end', () => {
    const resolveRefs = (refs: Record<string, ReferenceExpression>): Record<string, string> => (
      _(refs)
        .mapValues(ref => `${ref.elemID.typeName}.${ref.elemID.name}`)
        .value()
    )
    const typeWithHistoryTrackedFields = createCustomObjectType('TypeWithHistoryTracking__c', {
      annotations: {
        [OBJECT_HISTORY_TRACKING_ENABLED]: true,
      },
      fields: {
        fieldWithHistoryTracking: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            [API_NAME]: 'TypeWithHistoryTracking.FieldWithHistoryTracking',
            [FIELD_ANNOTATIONS.TRACK_HISTORY]: true,
          },
        },
        fieldWithoutHistoryTracking: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            [API_NAME]: 'TypeWithHistoryTracking.FieldWithoutHistoryTracking',
            [FIELD_ANNOTATIONS.TRACK_HISTORY]: false,
          },
        },
      },
    })
    describe('onFetch vs. preDeploy=>onDeploy', () => {
      it('should have the same output between onFetch and preDeploy=>onDeploy when adding an object', async () => {
        const elements = [typeWithHistoryTrackedFields.clone()]
        await filter.onFetch(elements)

        const changes = [toChange({ after: elements[0] })]
        getChangeData(changes[0]).annotations[HISTORY_TRACKED_FIELDS] = resolveRefs(getChangeData(changes[0])
          .annotations[HISTORY_TRACKED_FIELDS])

        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
        expect(changes).toHaveLength(1)
        expect(getChangeData(changes[0])).toEqual(elements[0])
      })
      it('should have the same output between onFetch and preDeploy=>onDeploy when adding a tracked field', async () => {
        const elements = [typeWithHistoryTrackedFields.clone()]
        await filter.onFetch(elements)

        const after = elements[0].clone()
        after.annotations[HISTORY_TRACKED_FIELDS].fieldWithoutHistoryTracking = (
          new ReferenceExpression(after.fields.fieldWithoutHistoryTracking.elemID))
        const changes = [toChange({ before: elements[0], after })]
        await filter.preDeploy(changes)
        expect(changes).toHaveLength(2)
        await filter.onDeploy(changes)
        expect(changes).toHaveLength(1)
        expect(getChangeData(changes[0])).toEqual(after)
      })
      it('should have the same output between onFetch and preDeploy=>onDeploy when removing a tracked field', async () => {
        const elements = [typeWithHistoryTrackedFields.clone()]
        await filter.onFetch(elements)

        const after = elements[0].clone()
        after.annotations[HISTORY_TRACKED_FIELDS] = {}
        const changes = [toChange({ before: elements[0], after })]
        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
        expect(changes).toHaveLength(1)
        expect(getChangeData(changes[0])).toEqual(after)
      })
      it('should have the same output between onFetch and preDeploy=>onDeploy when disabling history tracking', async () => {
        const elements = [typeWithHistoryTrackedFields.clone()]
        await filter.onFetch(elements)

        const after = elements[0].clone()
        delete after.annotations[HISTORY_TRACKED_FIELDS]
        const changes = [toChange({ before: elements[0], after })]
        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
        expect(changes).toHaveLength(1)
        expect(getChangeData(changes[0])).toEqual(after)
      })

      it('should have the same output between onFetch and preDeploy=>onDeploy when enabling history tracking', async () => {
        const type = typeWithHistoryTrackedFields.clone()
        type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = false
        type.fields.fieldWithHistoryTracking.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false
        const elements = [type]
        await filter.onFetch(elements)

        const after = elements[0].clone()
        after.annotations[HISTORY_TRACKED_FIELDS] = {
          fieldWithoutHistoryTracking: new ReferenceExpression(type.fields.fieldWithoutHistoryTracking.elemID),
        }

        const changes = [toChange({ before: elements[0], after })]
        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
        expect(changes).toHaveLength(1)
        expect(getChangeData(changes[0])).toEqual(after)
      })
    })
  })
})
