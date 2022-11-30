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
  ChangeError, getChangeData, ChangeValidator,
  isInstanceChange, InstanceElement, isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { isInstanceOfType } from '../filters/utils'
import { ASSIGNMENT_RULES_METADATA_TYPE } from '../constants'
import { apiName } from '../transformers/transformer'

const { awu } = collections.asynciterable
const { isDefined } = values

const isCaseRuleWithTeams = (instance: InstanceElement): boolean =>
  instance.value.assignmentRule.ruleEntry.some(entry => isDefined(entry.team))

const createChangeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Deployment of case assignment rule that references a predefined case team is not supported. Please remove the ‘team’ property in order to deploy this element and then configure its team via the salesforce UI.',
  detailedMessage: 'Deployment of case assignment rule that references a predefined case team is not supported. Please remove the ‘team’ property in order to deploy this element and then configure its team via the salesforce UI.',
})

/**
 * SF does not support deploy of case assignment rules with case teams.
 */
const changeValidator: ChangeValidator = async changes => awu(changes)
  .filter(isInstanceChange)
  .filter(isAdditionOrModificationChange)
  .map(getChangeData)
  .filter(isInstanceOfType(ASSIGNMENT_RULES_METADATA_TYPE))
  .filter(async change => await apiName(change) === 'Case')
  .filter(isCaseRuleWithTeams)
  .map(createChangeError)
  .toArray()

export default changeValidator
