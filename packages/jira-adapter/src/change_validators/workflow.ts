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
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceChange, SaltoErrorSeverity } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { UNDEPLOYALBE_POST_FUNCTION_TYPES, UNDEPLOYALBE_VALIDATOR_TYPES } from '../filters/workflow/workflow'
import { isWorkflowInstance, WorkflowInstance } from '../filters/workflow/types'
import { getLookUpName } from '../reference_mapping'

const { awu } = collections.asynciterable

const doesHaveUndeployableTypes = (instance: WorkflowInstance): boolean => {
  const doesContainUndeployablePostFunction = instance.value.transitions?.some(transition =>
    transition.rules?.postFunctions?.some(
      postFunction => UNDEPLOYALBE_POST_FUNCTION_TYPES.includes(postFunction.type ?? ''),
    )) ?? false

  const doesContainUndeployableValidator = instance.value.transitions?.some(transition =>
    transition.rules?.validators?.some(
      validator => UNDEPLOYALBE_VALIDATOR_TYPES.includes(validator.type ?? ''),
    )) ?? false

  return doesContainUndeployablePostFunction || doesContainUndeployableValidator
}

export const workflowValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === 'Workflow')
    .map(instance => resolveValues(instance, getLookUpName))
    .filter(isWorkflowInstance)
    .filter(doesHaveUndeployableTypes)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SaltoErrorSeverity,
      message: `Salto does not support deploying script-runner configuration in the instance ${instance.elemID.getFullName()}`,
      detailedMessage: 'Salto does not support deploying script-runner (com.onresolve.jira.groovy.groovyrunner) configuration. If continuing, they will be omitted from the deployment',
    }))
    .toArray()
)
