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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError, isAdditionOrModificationChange, isInstanceChange, ChangeValidator,
  InstanceElement, getChangeData,
} from '@salto-io/adapter-api'

const { awu } = collections.asynciterable

// cf. https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope
const INVALID_FILTERSCOPES = ['MyTeamTerritory']

export const isFilterScopeInvalid = async (
  element: InstanceElement
): Promise<boolean> => {
  const elemType = (await element.getType()).elemID.typeName
  return (elemType === 'ListView') && INVALID_FILTERSCOPES.includes(element.value.filterScope)
}

const invalidListViewFilterScopeError = (element: InstanceElement): ChangeError => (
  {
    elemID: element.elemID,
    severity: 'Error',
    message: `${element.elemID.getFullName()} uses '${element.value.filterScope}' as the 'filterScope' property of a ListView element. This is not allowed by SalesForce. See https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope`,
    detailedMessage: `You cannot use '${element.value.filterScope}' as a filterScope of a ListView`,
  }
)

/**
 * Some scopes are not allowed for ListViews.
 * cf. https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope
 */
const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(async elem => isFilterScopeInvalid(elem))
    .map(invalidListViewFilterScopeError)
    .toArray()
)

export default changeValidator
