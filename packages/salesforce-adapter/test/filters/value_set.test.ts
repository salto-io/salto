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
import { ElemID, InstanceElement, ObjectType, CORE_ANNOTATIONS, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/value_set'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { FIELD_ANNOTATIONS, GLOBAL_VALUE_SET_METADATA_TYPE } from '../../src/constants'

describe('value set filter', () => {
  const filter = filterCreator() as FilterWith<'onFetch' | 'onDeploy'>

  const customObjectName = 'PicklistTest'
  const fieldName = 'picklist_field'

  const mockElemID = new ElemID(constants.SALESFORCE, customObjectName)
  const createObjectWithPicklistField = (values?: string[], restricted = true): ObjectType =>
    new ObjectType({
      elemID: mockElemID,
      fields: { [fieldName]: {
        refType: Types.primitiveDataTypes.Picklist,
        annotations: {
          [constants.API_NAME]: `${customObjectName}.${fieldName}`,
          [constants.LABEL]: 'label',
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.FIELD_ANNOTATIONS.RESTRICTED]: restricted,
          ...values === undefined
            ? {}
            : { [constants.FIELD_ANNOTATIONS.VALUE_SET]: values.map(v => ({
              [constants.CUSTOM_VALUE.FULL_NAME]: v,
              [constants.CUSTOM_VALUE.DEFAULT]: false,
              [constants.CUSTOM_VALUE.LABEL]: v,
              [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
            })) },
        },
      } },
      annotations: {
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        [constants.API_NAME]: customObjectName,
        [constants.LABEL]: 'object label',
      },
    })

  describe('on fetch', () => {
    const PICKLIST_VALUES = ['val1', 'val2', 'val3']
    let objectWithPicklistField: ObjectType

    beforeEach(async () => {
      objectWithPicklistField = createObjectWithPicklistField(PICKLIST_VALUES)
    })

    describe('when object is not hidden', () => {
      beforeEach(async () => {
        await filter.onFetch([objectWithPicklistField])
      })
      it('should add restrictions', () => {
        const { annotations } = objectWithPicklistField.fields[fieldName]
        expect(annotations[CORE_ANNOTATIONS.RESTRICTION]).toEqual({
          enforce_value: true,
          values: PICKLIST_VALUES,
        })
      })
    })

    describe('when object is hidden', () => {
      beforeEach(async () => {
        objectWithPicklistField.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        await filter.onFetch([objectWithPicklistField])
      })
      it('should not add restrictions', () => {
        const { annotations } = objectWithPicklistField.fields[fieldName]
        expect(annotations[CORE_ANNOTATIONS.RESTRICTION]).toBeUndefined()
      })
    })
  })

  describe('on deploy', () => {
    describe('Global value set', () => {
      const globalValueSetName = 'GVSTest'
      const createGlobalValueSetInstanceElement = (values: string[]): InstanceElement =>
        new InstanceElement('global_value_set_test', new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, 'global_value_set'),
          annotationRefsOrTypes: {},
          annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET_METADATA_TYPE },
        }),
        {
          [constants.INSTANCE_FULL_NAME_FIELD]: globalValueSetName,
          [constants.DESCRIPTION]: globalValueSetName,
          sorted: false,
          [FIELD_ANNOTATIONS.CUSTOM_VALUE]: values.map(v => (
            {
              [constants.CUSTOM_VALUE.FULL_NAME]: v,
              [constants.CUSTOM_VALUE.DEFAULT]: false,
              [constants.CUSTOM_VALUE.LABEL]: v,
              [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
            })),
        })

      it('should add inactive values to global value set', async () => {
        const beforeInstance = createGlobalValueSetInstanceElement(['val1'])
        const afterInstance = createGlobalValueSetInstanceElement(['val2'])

        await filter.onDeploy([toChange({ before: beforeInstance, after: afterInstance })])
        expect(afterInstance.value[FIELD_ANNOTATIONS.CUSTOM_VALUE]).toEqual([{
          [constants.CUSTOM_VALUE.FULL_NAME]: 'val2',
          [constants.CUSTOM_VALUE.DEFAULT]: false,
          [constants.CUSTOM_VALUE.LABEL]: 'val2',
          [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
        },
        {
          [constants.CUSTOM_VALUE.FULL_NAME]: 'val1',
          [constants.CUSTOM_VALUE.DEFAULT]: false,
          [constants.CUSTOM_VALUE.LABEL]: 'val1',
          [constants.CUSTOM_VALUE.IS_ACTIVE]: false,
        }])
      })

      it('should not add inactive values when there were no deletions', async () => {
        const beforeInstance = createGlobalValueSetInstanceElement(['val1'])
        const afterInstance = createGlobalValueSetInstanceElement(['val1', 'val2'])
        await filter.onDeploy([toChange({ before: beforeInstance, after: afterInstance })])
        expect(afterInstance.value[FIELD_ANNOTATIONS.CUSTOM_VALUE]).toEqual([{
          [constants.CUSTOM_VALUE.FULL_NAME]: 'val1',
          [constants.CUSTOM_VALUE.DEFAULT]: false,
          [constants.CUSTOM_VALUE.LABEL]: 'val1',
          [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
        },
        {
          [constants.CUSTOM_VALUE.FULL_NAME]: 'val2',
          [constants.CUSTOM_VALUE.DEFAULT]: false,
          [constants.CUSTOM_VALUE.LABEL]: 'val2',
          [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
        }])
      })
    })

    describe('Custom picklist', () => {
      it('should add inactive values to custom picklist', async () => {
        const before = createObjectWithPicklistField(['val1']).fields[fieldName]
        const after = createObjectWithPicklistField(['val2']).fields[fieldName]

        await filter.onDeploy([toChange({ before, after })])
        expect(after.annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([{
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val2',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val2',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
          },
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val1',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val1',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: false,
          }])
      })

      it('should not add inactive values to non restricted custom picklist', async () => {
        const before = createObjectWithPicklistField(['val1'], false).fields[fieldName]
        const after = createObjectWithPicklistField(['val2'], false).fields[fieldName]

        await filter.onDeploy([toChange({ before, after })])
        expect(after.annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([{
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val2',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val2',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
          },
          ])
      })

      it('should not add inactive values to custom picklist when there were no deletions', async () => {
        const before = createObjectWithPicklistField(['val1']).fields[fieldName]
        const after = createObjectWithPicklistField(['val1', 'val2']).fields[fieldName]

        await filter.onDeploy([toChange({ before, after })])
        expect(after.annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([{
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val1',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val1',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
          },
          {
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val2',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val2',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
          },
          ])
      })

      it('should not add values to global picklist field in custom object', async () => {
        const before = createObjectWithPicklistField(['val1']).fields[fieldName]
        const after = createObjectWithPicklistField().fields[fieldName]

        await filter.onDeploy([toChange({ before, after })])
        expect(after.annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([{
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val1',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val1',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: false,
          },
          ])
      })
    })
  })
})
