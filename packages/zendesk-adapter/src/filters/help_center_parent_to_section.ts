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
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const SECTION_TYPE_NAME = 'section'

const deleteParentFields = (elem: InstanceElement): void => {
  delete elem.value.directParent
  delete elem.value.parentType
}

const addParentFields = (elem: InstanceElement): void => {
  if (elem.value.parent_section_id !== null) {
    elem.value.directParent = elem.value.parent_section_id
    elem.value.parentType = 'section'
  } else {
    elem.value.directParent = elem.value.category_id
    elem.value.parentType = 'category'
  }
}

const filterCreator: FilterCreator = () => ({
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .map(getChangeData)
      .forEach(deleteParentFields)
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .map(getChangeData)
      .forEach(addParentFields)
  },
})
export default filterCreator
