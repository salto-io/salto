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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  isAdditionOrModificationChange,
  isInstanceChange,
  ChangeValidator,
  InstanceElement,
  getChangeData,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType } from '../filters/utils'

const { awu } = collections.asynciterable

type ForbiddenFilterScope = {
  parentType: string
  filterScope: string
}

// cf. https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope
const INVALID_FILTERSCOPES: ForbiddenFilterScope[] = [
  {
    parentType: 'Opportunity',
    filterScope: 'MyTerritory',
  },
  {
    parentType: 'Opportunity',
    filterScope: 'MyTeamTerritory',
  },
]

export const isFilterScopeInvalid = async (
  instance: InstanceElement,
): Promise<boolean> => {
  if ((await apiName(await instance.getType())) !== 'ListView') {
    return false
  }
  return INVALID_FILTERSCOPES.some(
    (filterScopeDef) =>
      getParents(instance).some(
        (parentType) => parentType === filterScopeDef.parentType,
      ) && instance.value.filterScope === filterScopeDef.filterScope,
  )
}

const invalidListViewFilterScopeError = (
  element: InstanceElement,
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: 'Invalid filterScope value of a ListView',
  detailedMessage: `${element.elemID.getFullName()} uses '${element.value.filterScope}' as the 'filterScope' property of a ListView element. This is not allowed by SalesForce. See https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope`,
})

/**
 * Some scopes are not allowed for ListViews.
 * cf. https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope
 */
const changeValidator: ChangeValidator = async (changes) => {
  const typesOfInterest = INVALID_FILTERSCOPES.map(
    (scopeDef) => scopeDef.parentType,
  )
  return awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(async (elem) =>
      getParents(elem).some(isInstanceOfType(...typesOfInterest)),
    )
    .filter(async (elem) => isFilterScopeInvalid(elem))
    .map(invalidListViewFilterScopeError)
    .toArray()
}

export default changeValidator
