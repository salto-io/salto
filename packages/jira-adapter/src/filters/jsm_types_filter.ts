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

import _ from 'lodash'
import { getChangeData, isInstanceChange, Change, InstanceElement, isObjectType, CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { CUSTOMER_PERMISSIONS_TYPE } from '../constants'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../utils'
import { getLookUpName } from '../reference_mapping'

const jsmSupportedTypes = [CUSTOMER_PERMISSIONS_TYPE]

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'jsmTypesFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements
      .filter(obj => jsmSupportedTypes.includes(obj.elemID.typeName))
      .filter(isObjectType)
      .map(async obj => {
        setTypeDeploymentAnnotations(obj)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.CREATABLE)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.UPDATABLE)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.DELETABLE)
      })
    elements
      .filter(obj => jsmSupportedTypes.includes(obj.elemID.typeName))
      .filter(isInstanceElement)
      .forEach(obj => {
        obj.annotations[CORE_ANNOTATIONS.PARENT] = [obj.value.projectKey]
        delete obj.value.projectKey
      })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [jsmTypesChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        jsmSupportedTypes.includes(getChangeData(change).elemID.typeName)
        && isInstanceChange(change)
    )

    const deployResult = await deployChanges(
      jsmTypesChanges,
      async change => {
        const resolvedChange = await resolveChangeElement(change, getLookUpName)
        await deployment.deployChange({ change: resolvedChange,
          client,
          endpointDetails: jsmApiDefinitions.types[getChangeData(change).elemID.typeName].deployRequests })
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
