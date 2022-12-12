
/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ElemID,
  ObjectType,
  isReferenceExpression,
  ReferenceExpression,
  Change,
  toChange,
  getChangeData, Field,
} from '@salto-io/adapter-api'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../../../src/filter'
import filterCreator from '../../../src/filters/cpq/fix_value_set_api_names'
import {
  API_NAME,
  CPQ_NAMESPACE,
  CPQ_QUOTE,
  FIELD_ANNOTATIONS,
  FULL_NAME,
  HELP_TEXT,
  LABEL,
  SALESFORCE,
} from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'
import { mockTypes } from '../../mock_elements'

describe('cpqCustomFieldReferencesFilter', () => {
  const CPQ_MOCK_TYPE = `${CPQ_NAMESPACE}__MockType__c`
  const PICKLIST_FIELD_NAME = `${CPQ_NAMESPACE}__picklistField__c`

  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  let cpqObject: ObjectType

  beforeEach(() => {
    cpqObject = new ObjectType({
      elemID: new ElemID(SALESFORCE, CPQ_MOCK_TYPE),
      fields: {
        [PICKLIST_FIELD_NAME]: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            [HELP_TEXT]: 'test help text',
            [FIELD_ANNOTATIONS.VALUE_SET]: [
              {
                [FULL_NAME]: 'Quote',
                default: true,
                [LABEL]: 'Quote',
              },
            ],
            [API_NAME]: PICKLIST_FIELD_NAME,
          },
        },
      },
      annotations: {
        [API_NAME]: CPQ_MOCK_TYPE,
      },
    })
  })

  describe('onFetch', () => {
    beforeEach(async () => {
      const elements = [cpqObject, mockTypes[CPQ_QUOTE]]
      await filter.onFetch(elements)
    })
    it('should transform service API name to CPQ API name and create reference to the CPQ type', async () => {
      const reference = cpqObject.fields[PICKLIST_FIELD_NAME]
        .annotations[FIELD_ANNOTATIONS.VALUE_SET][0][FULL_NAME] as ReferenceExpression
      expect(isReferenceExpression(reference)).toBeTrue()
      expect(reference.elemID).toEqual(mockTypes[CPQ_QUOTE].elemID)
    })
  })
  describe('deploy flow', () => {
    let originalChange: Change<Field>
    let changes: Change<Field>[]

    beforeEach(() => {
      const originalField = cpqObject.fields[PICKLIST_FIELD_NAME]
      const valueSetEntry = originalField.annotations[FIELD_ANNOTATIONS.VALUE_SET][0]
      valueSetEntry[FULL_NAME] = CPQ_QUOTE
      const modifiedField = originalField.clone()
      modifiedField.annotations[HELP_TEXT] = 'modified help text'
      originalChange = toChange({ before: originalField, after: modifiedField })
      changes = [originalChange]
    })
    it('should revert to Service API name on preDeploy and revert to original change on onDeploy', async () => {
      await filter.preDeploy(changes)
      expect(changes).toHaveLength(1)
      const deployableModifiedField = getChangeData(changes[0])
      const modifiedApiName = deployableModifiedField
        .annotations[FIELD_ANNOTATIONS.VALUE_SET][0][FULL_NAME] as string
      expect(modifiedApiName).toBeString()
      expect(modifiedApiName).toEqual('Quote')
      await filter.onDeploy(changes)
      expect(changes).toEqual([originalChange])
    })
  })
})
