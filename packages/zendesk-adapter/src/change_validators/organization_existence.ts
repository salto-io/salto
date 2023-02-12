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
  getOrganizationsByIds,
  getOrganizationsByNames,
  TYPE_NAME_TO_REPLACER,
} from '../filters/organizations'
import ZendeskClient from '../client/client'
import { paginate } from '../client/pagination'
import { ZendeskFetchConfig } from '../config'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues

/**
 * Validates the existence of organizations that are referenced in added or modified elements
 */
export const organizationExistenceValidator: (client: ZendeskClient, fetchConfig: ZendeskFetchConfig) =>
    ChangeValidator = (client, fetchConfig) => async changes => {
      // If the organizations were resolved, they are stored as names instead of ids
      const orgIdsResolved = fetchConfig.resolveOrganizationIDs === true
      const relevantChanges = changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).map(getChangeData)
        .filter(instance => Object.keys(TYPE_NAME_TO_REPLACER).includes(instance.elemID.typeName))

      const organizationPathEntries = createOrganizationPathEntries(relevantChanges)
      const entriesByInstance = _.groupBy(organizationPathEntries, entry => entry.instance.elemID.getFullName())

      const paginator = clientUtils.createPaginator({ client, paginationFuncCreator: paginate })

      // Will be either a list of ids or a list of names
      const orgIdentifiers = Array.from(new Set<string>(
        Object.values(entriesByInstance).map(entries => entries.map(entry => entry.id)).flat()
      ))
      const existingOrgs = orgIdsResolved
        ? await getOrganizationsByNames(orgIdentifiers, paginator)
        : await getOrganizationsByIds(orgIdentifiers, client)

      const existingOrgsSet = new Set(existingOrgs.map(org => (orgIdsResolved ? org.name : org.id.toString())))

      // Because 'entriesByInstance' is already grouped by instance, we can run over it instead of over the changes
      const errors = await awu(Object.values(entriesByInstance)).map(async (entries)
          : Promise<ChangeError | undefined> => {
        const nonExistingOrgs = new Set<string>(entries.filter(({ id }) => !existingOrgsSet.has(id)).map(org => org.id))

        // If the instance includes an organization that does not exist, we won't allow a change to that instance
        if (nonExistingOrgs.size > 0) {
          return {
            elemID: entries[0].instance.elemID,
            severity: 'Error',
            message: 'Referenced organizations do not exist',
            detailedMessage: `The following referenced organizations do not exist: ${Array.from(nonExistingOrgs).join(', ')}`,
          }
        }
        return undefined
      }).filter(isDefined).toArray()

      return errors
    }
