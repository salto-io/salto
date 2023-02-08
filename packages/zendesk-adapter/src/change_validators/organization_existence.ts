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
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  createOrganizationPathEntries,
  getOrganizationsByNames,
  TYPE_NAME_TO_REPLACER,
} from '../filters/organizations'
import ZendeskClient from '../client/client'
import { paginate } from '../client/pagination'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues

/**
 * Validates the existence of organizations that are referenced in added or modified elements
 */
export const organizationExistenceValidator: (client: ZendeskClient) =>
    ChangeValidator = client => async changes => {
      const relevantChanges = changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).filter(change =>
        Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName))

      const organizationPathEntries = createOrganizationPathEntries(relevantChanges.map(getChangeData))
      const entriesByInstance = _.groupBy(organizationPathEntries, entry => entry.instance.elemID.getFullName())

      const paginator = clientUtils.createPaginator({ client, paginationFuncCreator: paginate })
      const errors = await awu(Object.values(entriesByInstance)).map(async (entries)
          : Promise<ChangeError | undefined> => {
        const nonExistingOrgs = await awu(entries).filter(async entry =>
          (await getOrganizationsByNames([entry.id], paginator))[0] === undefined).toArray()

        // If the instance includes an organization that does not exist, we won't allow a change to that instance
        if (nonExistingOrgs.length > 0) {
          return {
            elemID: entries[0].instance.elemID,
            severity: 'Error',
            message: 'Referenced organizations do not exist',
            detailedMessage: `The following referenced organizations does not exist: ${nonExistingOrgs.map(org => org.id).join(', ')}`,
          }
        }
        return undefined
      }).filter(isDefined).toArray()

      return errors
    }
