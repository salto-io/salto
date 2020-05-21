/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  ElemID, InstanceElement, ObjectType, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/value_set'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'
import { GLOBAL_VALUE_SET, MASTER_LABEL, CUSTOM_VALUE } from '../../src/filters/global_value_sets'
import { Types } from '../../src/transformers/transformer'

describe('lookup filters filter', () => {
  const filter = filterCreator() as FilterWith<'onUpdate'>

  describe('on update', () => {
    describe('Global value set', () => {
      const globalValueSetName = 'GVSTest'
      const createGlobalValueSetInstanceElement = (values: string[]): InstanceElement =>
        new InstanceElement('global_value_set_test', new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, 'global_value_set'),
          annotationTypes: {},
          annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET },
        }),
        {
          [constants.INSTANCE_FULL_NAME_FIELD]: globalValueSetName,
          [MASTER_LABEL]: globalValueSetName,
          [constants.DESCRIPTION]: globalValueSetName,
          sorted: false,
          [CUSTOM_VALUE]: values.map(v => (
            {
              [constants.CUSTOM_VALUE.FULL_NAME]: v,
              [constants.CUSTOM_VALUE.DEFAULT]: false,
              [constants.CUSTOM_VALUE.LABEL]: v,
              [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
            })),
        })

      it('should add inactive values to global value set', () => {
        const beforeInstance = createGlobalValueSetInstanceElement(['val1'])
        const afterInstance = createGlobalValueSetInstanceElement(['val2'])

        filter.onUpdate(
          beforeInstance,
          afterInstance,
          [{ action: 'modify', data: { before: beforeInstance, after: afterInstance } }]
        )
        expect(afterInstance.value[CUSTOM_VALUE]).toEqual([{
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

      it('should not add inactive values when there were no deletions', () => {
        const beforeInstance = createGlobalValueSetInstanceElement(['val1'])
        const afterInstance = createGlobalValueSetInstanceElement(['val1', 'val2'])
        filter.onUpdate(
          beforeInstance,
          afterInstance,
          [{ action: 'modify', data: { before: beforeInstance, after: afterInstance } }]
        )
        expect(afterInstance.value[CUSTOM_VALUE]).toEqual([{
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
      const customObjectName = 'PicklistTest'
      const fieldName = 'picklist_field'
      const mockElemID = new ElemID(constants.SALESFORCE, customObjectName)
      const createObjectWithPicklistField = (values?: string[], restricted = true): ObjectType =>
        new ObjectType({
          elemID: mockElemID,
          fields: { [fieldName]: {
            type: Types.primitiveDataTypes.Picklist,
            annotations: {
              [constants.API_NAME]: `${customObjectName}.${fieldName}`,
              [constants.LABEL]: 'label',
              [CORE_ANNOTATIONS.REQUIRED]: false,
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
            [constants.API_NAME]: customObjectName,
            [constants.LABEL]: 'object label',
          },
        })

      it('should add inactive values to custom picklist', () => {
        const beforeObject = createObjectWithPicklistField(['val1'])
        const afterObject = createObjectWithPicklistField(['val2'])

        filter.onUpdate(
          beforeObject,
          afterObject,
          [{ action: 'modify',
            data: {
              before: beforeObject.fields[fieldName],
              after: afterObject.fields[fieldName],
            } }]
        )
        expect(afterObject.fields[fieldName].annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
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

      it('should not add inactive values to non restricted custom picklist', () => {
        const beforeObject = createObjectWithPicklistField(['val1'], false)
        const afterObject = createObjectWithPicklistField(['val2'], false)

        filter.onUpdate(
          beforeObject,
          afterObject,
          [{ action: 'modify',
            data: {
              before: beforeObject.fields[fieldName],
              after: afterObject.fields[fieldName],
            } }]
        )
        expect(afterObject.fields[fieldName].annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
          .toEqual([{
            [constants.CUSTOM_VALUE.FULL_NAME]: 'val2',
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: 'val2',
            [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
          },
          ])
      })

      it('should not add inactive values to custom picklist when there were no deletions', () => {
        const beforeObject = createObjectWithPicklistField(['val1'])
        const afterObject = createObjectWithPicklistField(['val1', 'val2'])

        filter.onUpdate(
          beforeObject,
          afterObject,
          [{ action: 'modify',
            data: {
              before: beforeObject.fields[fieldName],
              after: afterObject.fields[fieldName],
            } }]
        )
        expect(afterObject.fields[fieldName].annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
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

      it('should not add values to global picklist field in custom object', () => {
        const beforeObject = createObjectWithPicklistField(['val1'])
        const afterObject = createObjectWithPicklistField()

        filter.onUpdate(
          beforeObject,
          afterObject,
          [{ action: 'modify',
            data: {
              before: beforeObject.fields[fieldName],
              after: afterObject.fields[fieldName],
            } }]
        )
        expect(afterObject.fields[fieldName].annotations[constants.FIELD_ANNOTATIONS.VALUE_SET])
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
