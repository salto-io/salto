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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  CORE_ANNOTATIONS,
  Field,
} from '@salto-io/adapter-api'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/restrict_value_sets'
import { Types } from '../../src/transformers/transformer'
import { defaultFilterContext } from '../utils'
import { FIELD_ANNOTATIONS, GLOBAL_VALUE_SET_METADATA_TYPE, INSTANCE_FULL_NAME_FIELD, LABEL } from '../../src/constants'

describe('Global Value Sets filter', () => {
  const OBJECT_NAME = 'Test__c'
  const GLOBAL_PICKLIST_FIELD_NAME = 'globalPicklist__c'
  const NON_EXISTING_GLOBAL_PICKLIST_FIELD_NAME = 'nonExistingGlobalPicklist__c'
  const PICKLIST_FIELD_NAME = 'picklistField__c'

  const GLOBAL_VALUE_SET_INSTANCE_NAME = 'globalValueSet'
  const NON_EXISTING_GLOBAL_VALUE_SET_INSTANCE_NAME = 'nonExistingGlobalValueSet'
  const GLOBAL_VALUE_SET_VALUES = ['val1', 'val2']
  const PICKLIST_VALUES = ['1', '2', '3']

  const filter = filterCreator({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  const TEST_FIELDS = [
    GLOBAL_PICKLIST_FIELD_NAME,
    NON_EXISTING_GLOBAL_PICKLIST_FIELD_NAME,
    PICKLIST_FIELD_NAME,
  ] as const
  type TestField = typeof TEST_FIELDS[number]
  let objectType: ObjectType & {
    fields: ObjectType['fields'] & Record<TestField, Field>
  }
  let globalValueSetInstance: InstanceElement

  beforeEach(async () => {
    globalValueSetInstance = new InstanceElement(GLOBAL_VALUE_SET_INSTANCE_NAME, new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, GLOBAL_VALUE_SET_METADATA_TYPE),
      annotationRefsOrTypes: {},
      annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET_METADATA_TYPE },
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: GLOBAL_VALUE_SET_INSTANCE_NAME,
      [constants.DESCRIPTION]: GLOBAL_VALUE_SET_INSTANCE_NAME,
      sorted: false,
      [FIELD_ANNOTATIONS.CUSTOM_VALUE]: GLOBAL_VALUE_SET_VALUES.map(v => (
        {
          [constants.CUSTOM_VALUE.FULL_NAME]: v,
          [constants.CUSTOM_VALUE.DEFAULT]: false,
          [constants.CUSTOM_VALUE.LABEL]: v,
          [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
        })),

    })
    objectType = new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, OBJECT_NAME),
      fields: {
        [GLOBAL_PICKLIST_FIELD_NAME]: {
          refType: Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.API_NAME]: GLOBAL_PICKLIST_FIELD_NAME,
            label: 'test label',
            [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: GLOBAL_VALUE_SET_INSTANCE_NAME,
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
          },
        },
        [NON_EXISTING_GLOBAL_PICKLIST_FIELD_NAME]: {
          refType: Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.API_NAME]: NON_EXISTING_GLOBAL_PICKLIST_FIELD_NAME,
            label: 'test label',
            [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: NON_EXISTING_GLOBAL_VALUE_SET_INSTANCE_NAME,
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
          },
        },
        [PICKLIST_FIELD_NAME]: {
          refType: Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.API_NAME]: PICKLIST_FIELD_NAME,
            label: 'test label',
            [constants.FIELD_ANNOTATIONS.VALUE_SET]: PICKLIST_VALUES.map(value => ({
              [INSTANCE_FULL_NAME_FIELD]: value,
              default: false,
              [LABEL]: value,
            })),
            [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
          },
        },
      },
      annotations: {
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        [constants.API_NAME]: OBJECT_NAME,
      },
    })
    await filter.onFetch([objectType, globalValueSetInstance])
  })

  describe('onFetch', () => {
    describe('GlobalValueSet', () => {
      describe('when matching GlobalValueSet instance exists', () => {
        it('should replace value set with reference and restrict the values', () => {
          const { annotations } = objectType.fields[GLOBAL_PICKLIST_FIELD_NAME]
          expect(annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(
            expect.objectContaining({ elemID: globalValueSetInstance.elemID })
          )
          expect(annotations[CORE_ANNOTATIONS.RESTRICTION]).toEqual({
            enforce_value: true,
            values: GLOBAL_VALUE_SET_VALUES,
          })
        })
      })
      it('should not replace value set with references if value set name does not exist', () => {
        const { annotations } = objectType.fields[NON_EXISTING_GLOBAL_PICKLIST_FIELD_NAME]
        expect(annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME])
          .toEqual(NON_EXISTING_GLOBAL_VALUE_SET_INSTANCE_NAME)
        expect(annotations[CORE_ANNOTATIONS.RESTRICTION]).toBeUndefined()
      })
    })
    describe('ValueSet', () => {
      it('should restrict values', () => {
        const { annotations } = objectType.fields[PICKLIST_FIELD_NAME]
        expect(annotations[CORE_ANNOTATIONS.RESTRICTION]).toEqual({
          enforce_value: true,
          values: PICKLIST_VALUES,
        })
      })
    })
  })
})
