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
import { Change, CORE_ANNOTATIONS, Element, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { BOARD_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable

const BOARD_LOCATION_TYPE = 'project'

/**
 * Change Board type structure to fit the deployment endpoint
 */
const filter: FilterCreator = () => ({
  name: 'boardFilter',
  onFetch: async (elements: Element[]) => {
    const boardLocationType = findObject(elements, 'Board_location')
    if (boardLocationType !== undefined) {
      boardLocationType.fields.projectId.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
      .forEach(instance => {
        instance.value.filterId = instance.value.config?.filter?.id
        delete instance.value.config?.filter
      })
  },

  preDeploy: async changes => {
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === BOARD_TYPE_NAME)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        instance => {
          if (instance.value.location?.projectId !== undefined) {
            instance.value.location.projectKeyOrId = instance.value.location.projectId
            instance.value.location.type = BOARD_LOCATION_TYPE
            delete instance.value.location.projectId
          }

          return instance
        }
      ))
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === BOARD_TYPE_NAME)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        instance => {
          if (instance.value.location?.projectKeyOrId !== undefined) {
            instance.value.location.projectId = instance.value.location.projectKeyOrId
            delete instance.value.location.projectKeyOrId
            delete instance.value.location.type
          }
          return instance
        }
      ))
  },
})

export default filter
