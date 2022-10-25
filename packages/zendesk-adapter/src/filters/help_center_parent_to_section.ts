/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { addRemovalChangesId } from './help_center_section_and_category'

const SECTION_TYPE_NAME = 'section'

const deleteParentFields = (elem: InstanceElement): void => {
  delete elem.value.direct_parent
  delete elem.value.parent_type
}

const addParentFields = (elem: InstanceElement): void => {
  if (elem.value.parent_section_id !== undefined) {
    elem.value.direct_parent = elem.value.parent_section_id
    elem.value.parent_type = 'section'
  } else {
    elem.value.direct_parent = elem.value.category_id
    elem.value.parent_type = 'category'
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .map(getChangeData)
      .forEach(deleteParentFields)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [parentChanges, leftoverChanges] = _.partition(
      changes,
      change => SECTION_TYPE_NAME === getChangeData(change).elemID.typeName
    )
    addRemovalChangesId(parentChanges)
    const deployResult = await deployChanges(
      parentChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, ['translations', 'parent_section_id'])
      }
    )
    // need to deploy separately parent_section_id if exists
    await deployChanges(
      parentChanges,
      async change => {
        if (isAdditionOrModificationChange(change)
          && getChangeData(change).value.parent_section_id !== undefined) {
          const ParentSectionInstance = new InstanceElement(
            getChangeData(change).elemID.name,
            await getChangeData(change).getType(),
            {
              id: getChangeData(change).value.id,
              parent_section_id: getChangeData(change).value.parent_section_id,
            }
          )
          await deployChange(
            toChange({ before: ParentSectionInstance, after: ParentSectionInstance }),
            client,
            config.apiDefinitions
          )
        }
      }
    )
    return { deployResult, leftoverChanges }
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .map(getChangeData)
      .forEach(addParentFields)
  },
})
export default filterCreator
