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
import { getChangeData, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/history_tracking'
import { createCustomObjectType, createField, defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { FilterWith } from '../../src/filter'
import { Types } from '../../src/transformers/transformer'
import { FIELD_HISTORY_TRACKING_ENABLED, HISTORY_TRACKED_FIELDS, OBJECT_HISTORY_TRACKING_ENABLED } from '../../src/constants'

describe('History tracking', () => {
  const filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch' | 'preDeploy'>
  const baseCustomObjectType = createCustomObjectType('TypeWithHistoryTracking', {
    fields: {
      fieldWithHistoryTracking: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          apiName: 'fieldWithHistoryTracking',
          trackHistory: true,
        },
      },
      fieldWithoutHistoryTracking: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          apiName: 'fieldWithoutHistoryTracking',
          trackHistory: false,
        },
      },
    },
  })

  describe('When fetching an object with history tracking disabled', () => {
    it('Should not modify the object', async () => {
      const inputType = mockTypes.Account.clone()
      inputType.annotations.enableHistory = false
      const expectedOutput = inputType.clone()
      delete expectedOutput.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
      const elements = [inputType]
      await filter.onFetch(elements)
      expect(elements).toEqual([expectedOutput])
    })
  })
  describe('When fetching an object with history tracking enabled', () => {
    let typeWithHistoryTrackedFields: ObjectType

    beforeAll(() => {
      typeWithHistoryTrackedFields = baseCustomObjectType.clone()
      typeWithHistoryTrackedFields.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = true
    })

    it('Should update the object and field annotations correctly', async () => {
      const elements = [typeWithHistoryTrackedFields.clone()]
      await filter.onFetch(elements)
      const trackedFieldNames = elements[0].annotations[HISTORY_TRACKED_FIELDS]
      expect(trackedFieldNames).toBeDefined()
      expect(trackedFieldNames).toEqual(['fieldWithHistoryTracking'])
      expect(elements[0].fields.fieldWithHistoryTracking.annotations.trackHistory).not.toBeDefined()
      expect(elements[0].fields.fieldWithoutHistoryTracking.annotations.trackHistory).not.toBeDefined()
      expect(elements[0].annotations[OBJECT_HISTORY_TRACKING_ENABLED]).not.toBeDefined()
    })
  })
  describe('on preDeploy', () => {
    const typeForPreDeploy = (trackedFields?: string[]): ObjectType => {
      const type = baseCustomObjectType.clone()
      if (trackedFields !== undefined) {
        type.annotations[HISTORY_TRACKED_FIELDS] = trackedFields
      }
      return type
    }

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
        const changes = [toChange({ before: typeForPreDeploy(['Somefield']), after: typeForPreDeploy() })]
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
      it('should add the enableHistory annotation if historyTrackedFields was modified', async () => {
        const changes = [toChange({ before: typeForPreDeploy(['Somefield']), after: typeForPreDeploy([]) })]
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
    })

    describe('when fields belong to an object that has history tracking disabled', () => {
      const field = createField(typeForPreDeploy(), Types.primitiveDataTypes.Text, 'SomeField')

      it('should not be modified if the field was modified', async () => {
        const after = field.clone()
        after.annotations.someAnnotation = true
        const changes = [toChange({ before: field, after })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(FIELD_HISTORY_TRACKING_ENABLED)
      })
      it('should not be modified if the field was added', async () => {
        const after = field.clone()
        const changes = [toChange({ after })]
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).annotations).not.toHaveProperty(FIELD_HISTORY_TRACKING_ENABLED)
      })
    })

    describe('when fields belong to an object that has history tracking enabled', () => {
      describe('when the field is not tracked', () => {
        const parentType = typeForPreDeploy(['NotMyField'])
        const field = createField(parentType, Types.primitiveDataTypes.Text, 'SomeField')

        it('should add trackHistory=false annotation if the field was modified', async () => {
          const after = field.clone()
          after.annotations.someAnnotation = true
          const changes = [toChange({ before: field, after })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_HISTORY_TRACKING_ENABLED, false)
        })
        it('should add trackHistory=false annotation if the field was added', async () => {
          const changes = [toChange({ after: field.clone() })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_HISTORY_TRACKING_ENABLED, false)
        })
      })
      describe('when the field is tracked', () => {
        const parentType = typeForPreDeploy(['SomeField'])
        const field = createField(parentType, Types.primitiveDataTypes.Text, 'SomeField')

        it('should add trackHistory=true annotation if the field was modified', async () => {
          const after = field.clone()
          after.annotations.someAnnotation = true
          const changes = [toChange({ before: field, after })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_HISTORY_TRACKING_ENABLED, true)
        })
        it('should add trackHistory=true annotation if the field was added', async () => {
          const changes = [toChange({ after: field.clone() })]
          await filter.preDeploy(changes)
          expect(getChangeData(changes[0]).annotations).toHaveProperty(FIELD_HISTORY_TRACKING_ENABLED, true)
        })
      })
    })
  })
})
