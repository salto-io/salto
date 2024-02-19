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
import {
  getChangeData,
  isInstanceChange,
  isObjectType,
  isAdditionChange,
  isModificationChange,
  CORE_ANNOTATIONS,
  Value,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { v4 as uuidv4 } from 'uuid'
import { FilterCreator } from '../../filter'
import {
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
  SCRIPT_RUNNER_SETTINGS_TYPE,
  SCRIPT_RUNNER_TYPES,
} from '../../constants'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { UserInfo, getCurrentUserInfo } from '../../users'

const { awu } = collections.asynciterable

const getTimeNowAsSeconds = (): number => Math.floor(Date.now() / 1000)

const AUDIT_SCRIPT_RUNNER_TYPES = SCRIPT_RUNNER_TYPES.filter(
  type => ![SCRIPT_RUNNER_LISTENER_TYPE, SCRIPT_FRAGMENT_TYPE].includes(type),
)

const addCreatedChanges = (value: Value, currentUserInfo: UserInfo | undefined, timeStampAsString: boolean): void => {
  value.createdByAccountId = currentUserInfo?.userId ?? ''
  value.createdTimestamp = timeStampAsString ? getTimeNowAsSeconds().toString() : getTimeNowAsSeconds()
}

const addUpdatedChanges = (value: Value, currentUserInfo: UserInfo | undefined, timeStampAsString: boolean): void => {
  value.updatedByAccountId = currentUserInfo?.userId ?? ''
  value.updatedTimestamp = timeStampAsString ? getTimeNowAsSeconds().toString() : getTimeNowAsSeconds()
}

// This filter is used to:
// * make script runner types deployable
// * make script runner settings only updatable
// * remove empty instances if exists
// * manage uuids
// * manage the audit items
const filter: FilterCreator = ({ client, config }) => ({
  name: 'scriptRunnerFilter',
  onFetch: async elements => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    const objectTypes = elements.filter(isObjectType)

    await awu(objectTypes)
      .filter(type => SCRIPT_RUNNER_TYPES.includes(type.elemID.typeName))
      .forEach(async type => {
        setTypeDeploymentAnnotations(type)
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.CREATABLE)
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.UPDATABLE)
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.DELETABLE)
      })
    await awu(objectTypes)
      .filter(type => type.elemID.typeName === SCRIPT_RUNNER_SETTINGS_TYPE)
      .forEach(async type => {
        type.annotations[CORE_ANNOTATIONS.CREATABLE] = false
        type.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
        type.annotations[CORE_ANNOTATIONS.DELETABLE] = false
        await addAnnotationRecursively(type, CORE_ANNOTATIONS.UPDATABLE)
      })

    // If there are non listeners in the service we will get a single instance with spaceRemaining
    const listeners = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === SCRIPT_RUNNER_LISTENER_TYPE)
    if (
      listeners.length === 1 &&
      listeners[0].elemID.name === 'unnamed_0' &&
      listeners[0].value.spaceRemaining !== undefined
    ) {
      elements.splice(elements.indexOf(listeners[0]), 1)
    }
  },
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon || client.isDataCenter) {
      return
    }

    const currentUserInfo = await getCurrentUserInfo(client)

    const additionInstances = changes.filter(isAdditionChange).filter(isInstanceChange).map(getChangeData)

    // Addition
    additionInstances
      .filter(instance => AUDIT_SCRIPT_RUNNER_TYPES.includes(instance.elemID.typeName))
      .forEach(instance => {
        instance.value.auditData = {}
        addCreatedChanges(instance.value.auditData, currentUserInfo, false)
        // generate uuid for new instances
        instance.value.uuid = uuidv4()
      })

    additionInstances
      .filter(instance => instance.elemID.typeName === SCRIPT_RUNNER_LISTENER_TYPE)
      .forEach(instance => {
        addCreatedChanges(instance.value, currentUserInfo, true)
        // generate uuid for new instances
        instance.value.uuid = uuidv4()
      })

    // Modification
    const modificationInstances = changes.filter(isModificationChange).filter(isInstanceChange).map(getChangeData)

    modificationInstances
      .filter(instance => AUDIT_SCRIPT_RUNNER_TYPES.includes(instance.elemID.typeName))
      .forEach(instance => {
        addUpdatedChanges(instance.value.auditData, currentUserInfo, false)
      })

    modificationInstances
      .filter(instance => instance.elemID.typeName === SCRIPT_RUNNER_LISTENER_TYPE)
      .forEach(instance => {
        addUpdatedChanges(instance.value, currentUserInfo, true)
      })
  },
})
export default filter
