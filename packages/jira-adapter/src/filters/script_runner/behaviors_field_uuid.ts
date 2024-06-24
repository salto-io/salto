/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { v4 as uuidv4 } from 'uuid'
import { getChangeData, isInstanceChange, Value, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { BEHAVIOR_TYPE } from '../../constants'

// This filter handles the field uuids in the behaviors
const filter: FilterCreator = ({ config }) => ({
  name: 'behaviorsFieldUuidFilter',
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
      .forEach(instance => {
        instance.value.config?.forEach((configField: Value) => {
          configField.fieldUuid = uuidv4()
        })
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
      .forEach(instance => {
        instance.value.config?.forEach((configField: Value) => {
          delete configField.fieldUuid
        })
      })
  },
})
export default filter
