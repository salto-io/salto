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

import { ChangeValidator, getChangeData, isAdditionChange, isInstanceChange, InstanceElement, SeverityLevel } from '@salto-io/adapter-api'
import { getAllReferencedIds } from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'
import { getNamespace } from '../filters/utils'
import { hasNamespace } from './package'
import { SBAA_NAMESPACE, SBAA_APPROVAL_CONDITION, SBAA_APPROVAL_RULE } from '../constants'
import { apiName } from '../transformers/transformer'

const { awu } = collections.asynciterable

/*
  Add a Warning on Addition sbaa ApprovalRules with Custom ConditionMet
  if there's also an Addition of an ApprovalCondition that references it
  because there is a trigger validation that does not allow these to be deployed together
*/
const changeValidator: ChangeValidator = async changes => {
  const sbaaAdditionInstances = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(async (instance: InstanceElement) => {
      const type = await instance.getType()
      return await hasNamespace(type) && (await getNamespace(type)) === SBAA_NAMESPACE
    })
    .toArray()
  const approvalRuleWithCustomCondAdditionInstances = await awu(sbaaAdditionInstances)
    .filter(async instance =>
      (await apiName(await instance.getType())) === SBAA_APPROVAL_RULE
      && instance.value.sbaa__ConditionsMet__c === 'Custom')
    .toArray()
  const idToRuleWithCustomAdditionInst = Object.fromEntries(
    approvalRuleWithCustomCondAdditionInstances
      .map(instance => [instance.elemID.getFullName(), instance]),
  )
  const approvalRuleAdditionInstWithCustomElemIDs = Object.keys(idToRuleWithCustomAdditionInst)
  const approvalConditionAdditionInstances = await awu(sbaaAdditionInstances)
    .filter(async instance =>
      (await apiName(await instance.getType())) === SBAA_APPROVAL_CONDITION)
    .toArray()
  const referencedFromAdditionConditions = new Set(approvalConditionAdditionInstances
    .flatMap(instance => Array.from(getAllReferencedIds(instance))))
  if (referencedFromAdditionConditions.size === 0) {
    return []
  }
  const rulesReferencedFromAdditionConditions = approvalRuleAdditionInstWithCustomElemIDs
    .filter(instanceElemID => referencedFromAdditionConditions.has(instanceElemID))
  return rulesReferencedFromAdditionConditions.map(referencedInstanceElemID =>
    ({
      elemID: idToRuleWithCustomAdditionInst[referencedInstanceElemID].elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy ApprovalRule with ConditionMet set to ‘Custom’',
      detailedMessage: 'Cannot deploy an ApprovalRule with ConditionMet set to ‘Custom‘ that has a referencing ApprovalCondition.\nYou can edit ConditionMet in Salto and set it to ‘All’ and deploy. Then, change it back to ‘Custom’ and deploy again.',
    })).filter(values.isDefined)
}

export default changeValidator
