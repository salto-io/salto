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

import { getChangeData, isFieldChange, toChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getReferencedElements } from '../reference_dependencies'
import { FilterCreator } from '../filter'
import { DEFAULT_DEPLOY_REFERENCED_ELEMENTS } from '../config'

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'additionalChanges',
  preDeploy: async changes => {
    const [fieldChanges, typeAndInstanceChanges] = _.partition(changes, isFieldChange)
    const elemIdSet = new Set(changes.map(getChangeData).map(elem => elem.elemID.getFullName()))
    const fieldsParents = _(fieldChanges)
      // field deletions should be handled by SOAP
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .map(field => field.parent)
      .filter(parent => !elemIdSet.has(parent.elemID.getFullName()))
      .uniqBy(parent => parent.elemID.getFullName())
      .value()

    const requiredElements = (await getReferencedElements(
      typeAndInstanceChanges.map(getChangeData).concat(fieldsParents),
      config.deploy?.deployReferencedElements ?? config.deployReferencedElements ?? DEFAULT_DEPLOY_REFERENCED_ELEMENTS
    )).map(elem => elem.clone())

    const additionalChanges = requiredElements.concat(fieldsParents)
      .map(elem => toChange({ before: elem, after: elem }))

    changes.push(...additionalChanges)
  },
})

export default filterCreator
