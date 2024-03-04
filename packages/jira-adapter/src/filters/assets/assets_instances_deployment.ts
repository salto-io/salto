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
  CORE_ANNOTATIONS,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import {
  OBJECT_TYPE_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
  OBJECT_SCHEMA_TYPE,
  OBJECT_SCHMEA_REFERENCE_TYPE_TYPE,
} from '../../constants'

const { awu } = collections.asynciterable
const SUPPORTED_TYPES = [OBJECT_SCHEMA_STATUS_TYPE, OBJECT_TYPE_TYPE, OBJECT_SCHMEA_REFERENCE_TYPE_TYPE]

/* This filter adds objectSchemaId to some assets instances
 * that need it in order to be deployed.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'assetsInstancesDeploymentFilter',
  preDeploy: async changes => {
    const { jsmApiDefinitions } = config
    if (
      !config.fetch.enableJSM ||
      !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium) ||
      jsmApiDefinitions === undefined
    ) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => SUPPORTED_TYPES.includes(instance.elemID.typeName))
      .filter(instance => hasValidParent(instance))
      .forEach(instance => {
        instance.value.objectSchemaId = getParent(instance).value.id
      })

    await awu(changes)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_TYPE)
      .filter(instance => instance.value.parentObjectTypeId?.elemID.typeName === OBJECT_SCHEMA_TYPE)
      .forEach(instance => {
        delete instance.value.parentObjectTypeId
      })
  },
  onDeploy: async changes => {
    const { jsmApiDefinitions } = config
    if (
      !config.fetch.enableJSM ||
      !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium) ||
      jsmApiDefinitions === undefined
    ) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => SUPPORTED_TYPES.includes(instance.elemID.typeName))
      .forEach(instance => {
        delete instance.value.objectSchemaId
      })
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_TYPE)
      .filter(instance => instance.value.parentObjectTypeId === undefined)
      .forEach(instance => {
        instance.value.parentObjectTypeId = instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]
      })
  },
})
export default filter
