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

import { ObjectType, ElemID, BuiltinTypes, InstanceElement, ReferenceExpression, ChangeError, toChange } from '@salto-io/adapter-api'
import sbaaApprovalRulesCustomCondition from '../../src/change_validators/sbaa_approval_rules_custom_condition'
import { CUSTOM_OBJECT, METADATA_TYPE, API_NAME, SBAA_APPROVAL_CONDITION, SBAA_APPROVAL_RULE } from '../../src/constants'

describe('sbaa addition approval rules with custom condition met with incoming addition references validator', () => {
  let changeErrors: Readonly<ChangeError[]>
  const approvalRuleObj = new ObjectType({
    elemID: new ElemID('salesforce', SBAA_APPROVAL_RULE),
    fields: {
      sbaa__ConditionsMet__c: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: SBAA_APPROVAL_RULE,
    },
  })
  const approvalConditionObj = new ObjectType({
    elemID: new ElemID('salesforce', SBAA_APPROVAL_CONDITION),
    fields: {
      refField: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: SBAA_APPROVAL_CONDITION,
    },
  })
  const approvalRuleInstCustomCond = new InstanceElement(
    'ruleInstCustom',
    approvalRuleObj,
    {
      sbaa__ConditionsMet__c: 'Custom',
    },
  )
  const approvalRuleInstAllCond = new InstanceElement(
    'ruleInstAll',
    approvalRuleObj,
    {
      sbaa__ConditionsMet__c: 'All',
    },
  )
  const approvalConditionWithRefToCustom = new InstanceElement(
    'condWithRefToCustom',
    approvalConditionObj,
    {
      refField: new ReferenceExpression(
        approvalRuleInstCustomCond.elemID,
        approvalRuleInstCustomCond,
      ),
    },
  )
  const approvalConditionWithRefToAll = new InstanceElement(
    'condWithRefToAll',
    approvalConditionObj,
    {
      refField: new ReferenceExpression(
        approvalRuleInstAllCond.elemID,
        approvalRuleInstAllCond,
      ),
    },
  )
  const approvalCondWithNoRef = new InstanceElement(
    'condWithNoRef',
    approvalConditionObj,
    {
      refField: 'noRef',
    },
  )

  it('Should return an error if the instance with custom condition met has a ref to from addition instance', async () => {
    changeErrors = await sbaaApprovalRulesCustomCondition(
      [
        toChange({ after: approvalConditionWithRefToCustom }),
        toChange({ after: approvalRuleInstCustomCond }),
      ]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(approvalRuleInstCustomCond.elemID)
  })

  it('Should have no error if the ref is to an inst with All condition', async () => {
    changeErrors = await sbaaApprovalRulesCustomCondition(
      [
        toChange({ after: approvalConditionWithRefToAll }),
        toChange({ after: approvalRuleInstAllCond }),
      ]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('Should have no error if the rule is with Custom cond but no add approvalCond with ref to it', async () => {
    changeErrors = await sbaaApprovalRulesCustomCondition(
      [
        toChange({ after: approvalConditionWithRefToAll }),
        toChange({ after: approvalCondWithNoRef }),
        toChange({
          before: approvalConditionWithRefToCustom,
          after: approvalConditionWithRefToCustom,
        }),
        toChange({ after: approvalRuleInstCustomCond }),
      ]
    )
  })
})
