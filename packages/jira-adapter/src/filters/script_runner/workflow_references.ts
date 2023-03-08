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

import { resolveChangeElement, restoreChangeElement } from '@salto-io/adapter-utils'
import { isInstanceChange, isAdditionOrModificationChange, getChangeData, Change, InstanceElement, AdditionChange, ModificationChange, isModificationChange, Value } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

const safeChangeClone = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): Change<InstanceElement> => {
  const result: Value = { action: change.action, data: { after: change.data.after.clone() } }
  if (isModificationChange(change)) {
    result.data = { ...result.data, before: change.data.before.clone() }
  }
  return result
}


// This filter is used to remove and return references in script runner workflows
// As the references are encoded we cannot wait for the references filter to resolve them
const filter: FilterCreator = ({ client, config }) => {
  const originalChanges: Record<string, Change<InstanceElement>> = {}
  return {
    name: 'scriptRunnerWorkflowReferencesFilter',
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
        return
      }
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async change => {
          const instance = getChangeData(change)
          originalChanges[instance.elemID.getFullName()] = safeChangeClone(change)
          instance.value.transitions = getChangeData(
            await resolveChangeElement(change, getLookUpName)
          ).value.transitions
        })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
        return
      }
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async change => {
          const instance = getChangeData(change)
          instance.value.transitions = (getChangeData(
            await restoreChangeElement(
              change,
              originalChanges,
              getLookUpName,
            )
          ) as InstanceElement).value.transitions
        })
    },
  }
}

export default filter
