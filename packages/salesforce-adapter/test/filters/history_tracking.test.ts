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
  Change, ChangeDataType, ElemID,
  Field,
  getChangeData,
  isFieldChange,
  isModificationChange,
  ModificationChange,
  ObjectType, ReferenceExpression,
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
  const createField = (parentType: ObjectType, fieldName: string, isTracked?: boolean): Field => (
    new Field(parentType, fieldName, Types.primitiveDataTypes.Text, {
      [API_NAME]: `${parentType.elemID.typeName}.${fieldName}`,
      ...(isTracked === undefined ? {} : { [FIELD_ANNOTATIONS.TRACK_HISTORY]: isTracked }),
    })
  )

  beforeEach(() => {
    filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })

  describe('onFetch', () => {
    let inputType: ObjectType
    describe('When fetching an object that does not support history tracking', () => {
      beforeEach(async () => {
        inputType = mockTypes.Account.clone()
        const elements = [inputType]
        await filter.onFetch(elements)
      })
      it('Should not add a trackHistory annotation', () => {
        expect(inputType).not.toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED)
      })
      it('Should not add object-level trackedFields annotation', () => {
        expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('Should not add field-level annotation', () => {
        Object.values(inputType.fields)
          .forEach(field => expect(field.annotations).not.toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY))
      })
    })
    describe('When fetching an object with history tracking disabled', () => {
      beforeEach(async () => {
        inputType = mockTypes.Account.clone()
        inputType.annotations.enableHistory = false
        Object.values(inputType.fields)
          .forEach(fieldDef => { fieldDef.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false })
        await filter.onFetch([inputType])
      })
      it('Should keep the existing trackHistory annotation', () => {
        expect(inputType.annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, false)
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
      beforeEach(async () => {
        inputType = typeWithHistoryTrackedFields.clone()
        await filter.onFetch([inputType])
      })
      it('Should keep the existing trackHistory annotation', () => {
        expect(inputType.annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
      })
      it('Should remove field-level annotation', () => {
        Object.values(inputType.fields)
          .forEach(field => expect(field.annotations).not.toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY))
      })
      it('Should aggregate the tracked fields into a single annotation', () => {
        const trackedFieldNames = inputType.annotations[HISTORY_TRACKED_FIELDS]
        expect(trackedFieldNames).toBeDefined()
        expect(trackedFieldNames).toEqual({
          fieldWithHistoryTracking: referenceForField('fieldWithHistoryTracking'),
        })
      })
    })
  })
  describe('preDeploy', () => {
    let inputType: ObjectType
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
      beforeEach(async () => {
        const type = createCustomObjectType('SomeObject', {
          fields: {
            SomeField: {
              refType: Types.primitiveDataTypes.Text,
              annotations: {
                apiName: 'SomeObject.SomeField',
              },
            },
          },
        })
        const change = toChange({ after: type })

        await filter.preDeploy([change])

        inputType = getChangeData(change)
      })


      it('Should not add a trackHistory annotation', () => {
        expect(inputType).not.toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED)
      })
      it('Should not add object-level trackedFields annotation', () => {
        expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
      })
      it('Should not add field-level annotation', () => {
        Object.values(inputType.fields)
          .forEach(field => expect(field.annotations).not.toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY))
      })
    })

    describe('when an object has no historyTrackedFields', () => {
      describe('when history tracking is not supported', () => {
        beforeEach(async () => {
          const type = typeForPreDeploy()
          delete type.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
          const change = toChange({ after: type })

          await filter.preDeploy([change])

          inputType = getChangeData(change)
        })

        it('should not crash', async () => {
          expect(inputType.annotations).not.toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED)
          expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
        })
      })

      describe('when history tracking is disabled', () => {
        beforeEach(async () => {
          const type = typeForPreDeploy()
          const change = toChange({ after: type })

          await filter.preDeploy([change])

          inputType = getChangeData(change)
        })

        it('should not crash', async () => {
          expect(inputType.annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, false)
          expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
        })
      })

      describe('when history tracking is enabled', () => {
        // This is a contradiction that should be caught by a CV - SALTO-4178
        beforeEach(async () => {
          const type = typeForPreDeploy()
          type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = true
          const change = toChange({ after: type })

          await filter.preDeploy([change])

          inputType = getChangeData(change)
        })

        it('should not crash', async () => {
          expect(inputType.annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
          expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
        })
        it('should set all field-level annotations to false', () => {
          Object.values(inputType.fields)
            .forEach(field => expect(field.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false))
        })
      })
    })
    describe('when an object type has a historyTrackedFields annotation', () => {
      describe('when the object type is new', () => {
        describe('when there are no tracked fields', () => {
          beforeEach(async () => {
            const change = toChange({ after: typeForPreDeploy([]) })
            await filter.preDeploy([change])

            inputType = getChangeData(change)
          })
          it('should remove the list of tracked fields', () => {
            expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
          })
          it('should add the enableHistory annotation', () => {
            expect(inputType.annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
          })
          it('should set all field-level annotations to false', () => {
            Object.values(inputType.fields)
              .forEach(field => expect(field.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false))
          })
        })
        describe('when there are tracked fields', () => {
          beforeEach(async () => {
            const change = toChange({ after: typeForPreDeploy(['SomeField'], ['SomeField', 'UntrackedField']) })
            await filter.preDeploy([change])
            inputType = getChangeData(change)
          })
          it('should remove the list of tracked fields', () => {
            expect(inputType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
          })
          it('should add the enableHistory annotation', () => {
            expect(inputType.annotations).toHaveProperty(OBJECT_HISTORY_TRACKING_ENABLED, true)
          })
          it('should set all field-level annotations correctly', () => {
            expect(inputType.fields.SomeField.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, true)
            expect(inputType.fields.UntrackedField.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false)
          })
        })
      })
      describe('when the existing annotation was modified', () => {
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

        describe('fields are added', () => {
          const expectFieldTrackingAdditionChange = (change: Change): void => expectFieldTrackingChange(change, false)

          describe.each([
            ['unknown fields',
              typeForPreDeploy(),
              typeForPreDeploy(['Garbage']),
              false,
              [],
            ],
            ['existing field, tracking is unchanged',
              typeForPreDeploy([], ['SomeField']),
              typeForPreDeploy(['SomeField'], ['SomeField']),
              true,
              ['SomeField'],
            ],
            ['new field, tracking is unchanged',
              typeForPreDeploy([], []),
              typeForPreDeploy(['SomeField'], ['SomeField']),
              true,
              ['SomeField'],
            ],
            ['existing field, tracking is enabled',
              typeForPreDeploy(undefined, ['SomeField']),
              typeForPreDeploy(['SomeField'], ['SomeField']),
              true,
              ['SomeField'],
            ],
            ['new field, tracking is enabled',
              typeForPreDeploy(undefined, []),
              typeForPreDeploy(['SomeField'], ['SomeField']),
              true,
              ['SomeField'],
            ],
          ])('%s', (_desc, before, after, shouldAddChanges, trackedFields: string[]) => {
            let changes: Change<ObjectType>[]
            beforeEach(async () => {
              changes = [toChange({ before, after })]
              await filter.preDeploy(changes)
            })
            it('should create new changes if needed', () => {
              expect(changes).toHaveLength(shouldAddChanges ? 2 : 1)
              if (shouldAddChanges) {
                expectFieldTrackingAdditionChange(changes[1])
              }
            })
            it('should remove the list of tracked fields', async () => {
              const objType = getChangeData(changes[0])
              expect(objType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
            })
            it('should set all field-level annotations correctly', () => {
              const objType = getChangeData(changes[0])
              Object.values(objType.fields)
                .forEach(field => (
                  expect(field.annotations)
                    .toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, trackedFields.includes(field.name))
                ))
            })
          })
        })
        describe('fields are removed', () => {
          const expectFieldTrackingRemovalChange = (change: Change): void => expectFieldTrackingChange(change, true)
          describe.each([
            ['field remains, tracking is unchanged',
              typeForPreDeploy(['SomeField'], ['SomeField']),
              typeForPreDeploy([], ['SomeField']),
              true,
              [],
            ],
            ['field is removed, tracking is unchanged',
              typeForPreDeploy(['SomeField'], ['SomeField']),
              typeForPreDeploy([]),
              false,
              [],
            ],
            //
          ])('%s', (_desc, before, after, shouldAddChanges, trackedFields: string[]) => {
            let changes: Change<ObjectType>[]
            beforeEach(async () => {
              changes = [toChange({ before, after })]
              await filter.preDeploy(changes)
            })

            it('should not create new changes', () => {
              expect(changes).toHaveLength(shouldAddChanges ? 2 : 1)
              if (shouldAddChanges) {
                expectFieldTrackingRemovalChange(changes[1])
              }
            })
            it('should remove the list of tracked fields', async () => {
              const objType = getChangeData(changes[0])
              expect(objType.annotations).not.toHaveProperty(HISTORY_TRACKED_FIELDS)
            })
            it('should set all field-level annotations correctly', () => {
              const objType = getChangeData(changes[0])
              Object.values(objType.fields)
                .forEach(field => (
                  expect(field.annotations)
                    .toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, trackedFields.includes(field.name))
                ))
            })
          })
        })
      })
    })

    describe('field changes', () => {
      describe('parent has history tracking disabled', () => {
        const parentType = typeForPreDeploy()
        describe.each([
          ['field was modified',
            createField(parentType, 'SomeField'),
            createField(parentType, 'SomeField'),
          ],
          ['field was added',
            undefined,
            createField(parentType, 'SomeField'),
          ],
        ])('%s', (_desc, before, after) => {
          let field: Field
          beforeEach(async () => {
            const changes = [toChange({ before, after })]
            await filter.preDeploy(changes)
            field = getChangeData(changes[0])
          })
          it('should add \'trackHistory=false\'', async () => {
            expect(field.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, false)
          })
        })
      })

      describe('parent has history tracking enabled', () => {
        const parentType = typeForPreDeploy(['SomeField'])
        describe.each([
          ['untracked field was modified',
            createField(parentType, 'NotSomeField'),
            createField(parentType, 'NotSomeField'),
            false,
          ],
          ['untracked field was added',
            undefined,
            createField(parentType, 'NotSomeField'),
            false,
          ],
          ['tracked field was modified',
            createField(parentType, 'SomeField'),
            createField(parentType, 'SomeField'),
            true,
          ],
          ['tracked field was added',
            undefined,
            createField(parentType, 'SomeField'),
            true,
          ],
        ])('%s', (_desc, before, after, isTracked) => {
          let field: Field
          beforeEach(async () => {
            const changes = [toChange({ before, after })]
            await filter.preDeploy(changes)
            field = getChangeData(changes[0])
          })
          it('should set the trackHistory annotation correctly', async () => {
            expect(field.annotations).toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY, isTracked)
          })
        })
      })
    })
  })
  describe('onDeploy', () => {
    describe('Unrelated field changes', () => {
      let changes: Change[]
      beforeEach(async () => {
        const field = createField(mockTypes.Account, 'SomeField')
        changes = [
          toChange({ before: field }),
          toChange({ after: field }),
          toChange({ before: field, after: field.clone() }),
        ]
        getChangeData(changes[2]).annotations.unrelatedAnnotation = 'Something'
        await filter.onDeploy(changes)
      })
      it('should not effect unrelated changes', () => {
        expect(changes).toHaveLength(3)
        changes.forEach(change => (
          expect(getChangeData(change).annotations).not.toHaveProperty(FIELD_ANNOTATIONS.TRACK_HISTORY)
        ))
      })
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
      describe('when adding an object', () => {
        let beforePreDeploy: ChangeDataType[]
        let afterOnDeploy: Change[]
        beforeEach(async () => {
          const elements = [typeWithHistoryTrackedFields.clone()]
          await filter.onFetch(elements)
          beforePreDeploy = elements

          afterOnDeploy = [toChange({ after: elements[0].clone() })]
          const objectType = getChangeData(afterOnDeploy[0])
          objectType.annotations[HISTORY_TRACKED_FIELDS] = resolveRefs(objectType.annotations[HISTORY_TRACKED_FIELDS])

          await filter.preDeploy(afterOnDeploy)
          await filter.onDeploy(afterOnDeploy)
        })
        it('should be equal', () => {
          expect(afterOnDeploy).toHaveLength(1)
          expect(getChangeData(afterOnDeploy[0])).toEqual(beforePreDeploy[0])
        })
      })
      describe('when adding a tracked field', () => {
        let beforePreDeploy: ChangeDataType[]
        let afterOnDeploy: Change[]
        beforeEach(async () => {
          const elements = [typeWithHistoryTrackedFields.clone()]
          await filter.onFetch(elements)

          const after = elements[0].clone()
          beforePreDeploy = [after]
          after.annotations[HISTORY_TRACKED_FIELDS].fieldWithoutHistoryTracking = (
            new ReferenceExpression(after.fields.fieldWithoutHistoryTracking.elemID))
          const changes = [toChange({ before: elements[0], after })]
          await filter.preDeploy(changes)
          expect(changes).toHaveLength(2)
          await filter.onDeploy(changes)
          afterOnDeploy = changes
        })
        it('should be equal', () => {
          expect(afterOnDeploy).toHaveLength(1)
          expect(getChangeData(afterOnDeploy[0])).toEqual(beforePreDeploy[0])
        })
      })
      describe('when removing a tacked field', () => {
        let beforePreDeploy: ChangeDataType[]
        let afterOnDeploy: Change[]
        beforeEach(async () => {
          const elements = [typeWithHistoryTrackedFields.clone()]
          await filter.onFetch(elements)

          const after = elements[0].clone()
          after.annotations[HISTORY_TRACKED_FIELDS] = {}
          beforePreDeploy = [after]
          const changes = [toChange({ before: elements[0], after })]
          await filter.preDeploy(changes)
          await filter.onDeploy(changes)
          afterOnDeploy = changes
        })
        it('should be equal', () => {
          expect(afterOnDeploy).toHaveLength(1)
          expect(getChangeData(afterOnDeploy[0])).toEqual(beforePreDeploy[0])
        })
      })
      describe('when disabling history tracking', () => {
        let beforePreDeploy: ChangeDataType[]
        let afterOnDeploy: Change[]
        beforeEach(async () => {
          const elements = [typeWithHistoryTrackedFields.clone()]
          await filter.onFetch(elements)

          const after = elements[0].clone()
          after.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = false
          delete after.annotations[HISTORY_TRACKED_FIELDS]
          beforePreDeploy = [after]
          const changes = [toChange({ before: elements[0], after })]
          await filter.preDeploy(changes)
          await filter.onDeploy(changes)
          afterOnDeploy = changes
        })
        it('should be equal', () => {
          expect(afterOnDeploy).toHaveLength(1)
          expect(getChangeData(afterOnDeploy[0])).toEqual(beforePreDeploy[0])
        })
      })
      describe('when enabling history tracking', () => {
        let beforePreDeploy: ChangeDataType[]
        let afterOnDeploy: Change[]
        beforeEach(async () => {
          const type = typeWithHistoryTrackedFields.clone()
          type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = false
          type.fields.fieldWithHistoryTracking.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false
          const elements = [type]
          await filter.onFetch(elements)

          const after = elements[0].clone()
          after.annotations[HISTORY_TRACKED_FIELDS] = {
            fieldWithoutHistoryTracking: new ReferenceExpression(type.fields.fieldWithoutHistoryTracking.elemID),
          }

          beforePreDeploy = [after]
          const changes = [toChange({ before: elements[0], after })]
          await filter.preDeploy(changes)
          await filter.onDeploy(changes)
          afterOnDeploy = changes
        })
        it('should be equal', () => {
          expect(afterOnDeploy).toHaveLength(1)
          expect(getChangeData(afterOnDeploy[0])).toEqual(beforePreDeploy[0])
        })
      })
    })
  })
})
