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

import { resolveValues, restoreValues } from '@salto-io/adapter-utils'
import { isInstanceChange, isAdditionOrModificationChange, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable


// This filter is used to remove and return references in script runner workflows
// As the references are encoded we cannot wait for the references filter to resolve them
const filter: FilterCreator = ({ config }) => {
  const originalInstances: Record<string, InstanceElement> = {}
  return {
    name: 'scriptRunnerWorkflowReferencesFilter',
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async instance => {
          originalInstances[instance.elemID.getFullName()] = instance.clone()
          instance.value.transitions = (
            await resolveValues(instance, getLookUpName)
          ).value.transitions
        })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async instance => {
          instance.value.transitions = (await restoreValues(
            instance,
            originalInstances[instance.elemID.getFullName()],
            getLookUpName,
          )).value.transitions
        })
    },
  }
}

export default filter
