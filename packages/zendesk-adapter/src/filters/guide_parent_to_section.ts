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
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, toChange, Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { addRemovalChangesId } from './guide_section_and_category'
import {
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  ARTICLES_FIELD,
  SECTIONS_FIELD,
  TRANSLATIONS_FIELD,
  BRAND_FIELD,
} from '../constants'

const PARENT_SECTION_ID_FIELD = 'parent_section_id'

const deleteParentFields = (elem: InstanceElement): void => {
  delete elem.value.direct_parent_id
  delete elem.value.direct_parent_type
}

export const addParentFields = (value: Values): void => {
  if (value.parent_section_id === undefined || value.parent_section_id === null) {
    value.direct_parent_id = value.category_id
    value.direct_parent_type = CATEGORY_TYPE_NAME
  } else {
    value.direct_parent_id = value.parent_section_id
    value.direct_parent_type = SECTION_TYPE_NAME
  }
}

// the fields 'direct_parent_id' and 'direct_parent_type' are created during fetch, therefore this
// filter omits these fields in preDeploy. and adds them in onDeploy. During deploy, the field
// 'parent_section_id' is ignored and is deployed as modification change separately later.
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'guideParentSection',
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
        await deployChange(
          change,
          client,
          config.apiDefinitions,
          [TRANSLATIONS_FIELD, PARENT_SECTION_ID_FIELD, ARTICLES_FIELD, SECTIONS_FIELD, BRAND_FIELD]
        )
      }
    )
    // need to deploy separately parent_section_id if exists since zendesk API does not support
    // parent_section_id if the data request has more fields in it.
    await deployChanges(
      parentChanges,
      async change => {
        if (isAdditionOrModificationChange(change)
          && getChangeData(change).value.parent_section_id !== undefined) {
          const parentSectionInstanceAfter = new InstanceElement(
            getChangeData(change).elemID.name,
            await getChangeData(change).getType(),
            {
              id: getChangeData(change).value.id,
              [PARENT_SECTION_ID_FIELD]: getChangeData(change).value.parent_section_id,
            }
          )
          const parentSectionInstanceBefore = new InstanceElement(
            getChangeData(change).elemID.name,
            await getChangeData(change).getType(),
            {
              id: getChangeData(change).value.id,
            }
          )
          await deployChange(
            toChange({ before: parentSectionInstanceBefore, after: parentSectionInstanceAfter }),
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
      .forEach(elem => addParentFields(elem.value))
  },
})
export default filterCreator
