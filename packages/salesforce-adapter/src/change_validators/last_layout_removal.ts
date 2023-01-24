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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange, isInstanceElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { apiName } from '../transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD, LAYOUT_TYPE_ID_METADATA_TYPE as LAYOUT_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

const getObjectName = (layoutInstance: InstanceElement): string => (
  layoutInstance.value[INSTANCE_FULL_NAME_FIELD].split('-')[0]
)

const createOnlyLayoutError = (
  instance: InstanceElement,
  objectName: string,
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Cannot delete the only layout',
  detailedMessage: `Could not deploy Layout instance ${instance.elemID.name} since the Object ${objectName}
  must have at-least one remaining layout`,
})

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  const isInstanceOfTypeLayout = async (instance: InstanceElement): Promise<boolean> => (
    await apiName(await instance.getType(elementsSource)) === LAYOUT_METADATA_TYPE
  )

  const relevantChanges = await awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .filter(change => isInstanceOfTypeLayout(getChangeData(change)))
    .toArray()

  if (_.isEmpty(relevantChanges)) {
    return []
  }

  const relevantChangesByObjectName = _.groupBy(
    relevantChanges,
    change => getObjectName(getChangeData(change))
  )

  const objectsWithRemainingLayouts = Object.keys(
    _.groupBy(
      await awu(await elementsSource.getAll())
        .filter(isInstanceElement)
        .filter(isInstanceOfTypeLayout)
        .toArray(),
      getObjectName,
    )
  )

  return Object.entries(relevantChangesByObjectName)
    .filter(([objectName]) => !objectsWithRemainingLayouts.includes(objectName))
    .flatMap(([objectName, deletedLayoutChanges]) =>
      deletedLayoutChanges
        .map(getChangeData)
        .map(instance => createOnlyLayoutError(instance, objectName)))
}

export default changeValidator
