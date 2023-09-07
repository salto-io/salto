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
import { getChangeData, isModificationChange, isAdditionChange } from '@salto-io/adapter-api'
import { getParent, getParents, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, SCRIPT_FRAGMENT_TYPE, SCRIPT_RUNNER_LISTENER_TYPE, SECURITY_LEVEL_TYPE, WORKFLOW_TYPE_NAME } from './constants'

export const getWorkflowGroup: deployment.ChangeIdFunction = async change => (
  isModificationChange(change)
    && getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME
    ? 'Workflow Modifications'
    : undefined
)

export const getSecurityLevelGroup: deployment.ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (!isAdditionChange(change)
    || instance.elemID.typeName !== SECURITY_LEVEL_TYPE) {
    return undefined
  }

  const parents = getParents(instance)
  if (parents.length !== 1 || !isResolvedReferenceExpression(parents[0])) {
    throw new Error(`${instance.elemID.getFullName()} must have exactly one reference expression parent`)
  }

  return parents[0].elemID.getFullName()
}


const getFieldConfigItemGroup: deployment.ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (instance.elemID.typeName !== FIELD_CONFIGURATION_ITEM_TYPE_NAME) {
    return undefined
  }

  const parent = getParent(instance)

  return `${parent.elemID.getFullName()} items`
}

const getScriptListenersGroup: deployment.ChangeIdFunction = async change =>
  (getChangeData(change).elemID.typeName === SCRIPT_RUNNER_LISTENER_TYPE
    ? 'Script Listeners'
    : undefined)

const getScriptedFragmentsGroup: deployment.ChangeIdFunction = async change =>
  (getChangeData(change).elemID.typeName === SCRIPT_FRAGMENT_TYPE
    ? 'Scripted Fragments'
    : undefined)

export const getChangeGroupIds = deployment.getChangeGroupIdsFunc([
  getWorkflowGroup,
  getSecurityLevelGroup,
  getFieldConfigItemGroup,
  getScriptListenersGroup,
  getScriptedFragmentsGroup,
])
