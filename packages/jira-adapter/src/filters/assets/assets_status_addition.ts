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

import { getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { ASSETS_OBJECT_TYPE, ASSETS_STATUS_TYPE } from '../../constants'


const { awu } = collections.asynciterable
const SUPPORTED_TYPES = [ASSETS_STATUS_TYPE, ASSETS_OBJECT_TYPE]
const filter: FilterCreator = ({ config }) => ({
  name: 'assetsStatusAdditionFilter',
  preDeploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM
        || !config.fetch.enableJsmExperimental
        || jsmApiDefinitions === undefined) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => SUPPORTED_TYPES.includes(instance.elemID.typeName))
      .forEach(instance => {
        instance.value.objectSchemaId = getParent(instance).value.id
      })
  },
  onDeploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM
        || !config.fetch.enableJsmExperimental
        || jsmApiDefinitions === undefined) {
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
  },
})
export default filter
