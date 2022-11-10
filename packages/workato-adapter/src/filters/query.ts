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
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)

const filter: FilterCreator = ({ fetchQuery }) => ({
  name: 'queryFilter',
  onFetch: async elements => {
    const removedInstances = _.remove(
      elements,
      element => (
        isInstanceElement(element)
        && element.elemID.typeName !== RECIPE_CODE_TYPE
        && !fetchQuery.isInstanceMatch(element)
      )
    )
    // remove dependent recipe__code instances based on their parent recipe
    const recipeCodesToRemove = new Set(removedInstances
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === RECIPE_TYPE)
      .filter(inst =>
        isReferenceExpression(inst.value.code)
        && inst.value.code.elemID.typeName === RECIPE_CODE_TYPE)
      .map(inst => inst.value.code.elemID.name))
    removedInstances.concat(_.remove(
      elements,
      element => (
        isInstanceElement(element)
        && element.elemID.typeName === RECIPE_CODE_TYPE
        && recipeCodesToRemove.has(element.elemID.name)
      )
    ))

    if (removedInstances.length > 0) {
      log.debug(`Omitted ${removedInstances.length} instances that did not match the fetch criteria. The first 100 ids that were removed are: ${removedInstances.slice(0, 100).map(e => e.elemID.getFullName()).join(', ')}`)
    }
  },
})


export default filter
