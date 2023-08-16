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
import { getChangeData, isInstanceChange, isObjectType, isAdditionChange,
  isModificationChange, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { v4 as uuidv4 } from 'uuid'
import { FilterCreator } from '../../filter'
import { SCRIPT_RUNNER_TYPES } from '../../constants'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { getCurrentUserInfo } from '../../users'

const { awu } = collections.asynciterable

const getTimeNowAsSeconds = (): number => Math.floor(Date.now() / 1000)

// This filter is used to make script runner types deployable, and to manage the audit items
const filter: FilterCreator = ({ client, config }) => ({
  name: 'scriptRunnerFilter',
  onFetch: async elements => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    await awu(elements)
      .filter(isObjectType)
      .filter(type => SCRIPT_RUNNER_TYPES.includes(type.elemID.typeName))
      .forEach(async type => {
        setTypeDeploymentAnnotations(type)
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.CREATABLE)
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.UPDATABLE)
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.DELETABLE)
      })
  },
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon || client.isDataCenter) {
      return
    }

    // update audit info
    const currentUserInfo = await getCurrentUserInfo(client)

    changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => SCRIPT_RUNNER_TYPES.includes(instance.elemID.typeName))
      .forEach(instance => {
        instance.value.auditData = {
          createdByAccountId: currentUserInfo?.userId ?? '',
          createdTimestamp: getTimeNowAsSeconds(),
        }
        // generate uuid for new instances
        instance.value.uuid = uuidv4()
      })

    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => SCRIPT_RUNNER_TYPES.includes(instance.elemID.typeName))
      .forEach(instance => {
        instance.value.auditData.updatedByAccountId = currentUserInfo?.userId ?? ''
        instance.value.auditData.updatedTimestamp = getTimeNowAsSeconds()
      })
  },
})
export default filter
