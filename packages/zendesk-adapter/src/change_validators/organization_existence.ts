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
import { logger } from '@salto-io/logging'
import {
  createOrganizationPathEntries,
  getOrganizationsByIds,
  getOrganizationsByNames, Organization,
  TYPE_NAME_TO_REPLACER,
} from '../filters/organizations'
import ZendeskClient from '../client/client'
import { paginate } from '../client/pagination'
import { ZendeskFetchConfig } from '../config'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

/**
 * Validates the existence of organizations that are referenced in added or modified elements
 */
export const organizationExistenceValidator: (client: ZendeskClient, fetchConfig: ZendeskFetchConfig) =>
    ChangeValidator = (client, fetchConfig) => async changes => {
      // If the organizations were resolved, they are stored as names instead of ids
      // If the user change this config between a fetch and a deploy, this validator will fail
      // This is a known issue and is ok because handling it is not trivial and the use case shouldn't be common
      const orgIdsResolved = fetchConfig.resolveOrganizationIDs === true

      const relevantChanges = changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).map(getChangeData)
        .filter(instance => Object.keys(TYPE_NAME_TO_REPLACER).includes(instance.elemID.typeName))

      const organizationPathEntries = createOrganizationPathEntries(relevantChanges)
      const entriesByInstance = _.groupBy(organizationPathEntries, entry => entry.instance.elemID.getFullName())

      const paginator = clientUtils.createPaginator({ client, paginationFuncCreator: paginate })

      // Will be either a list of ids or a list of names, depends on the resolveOrganizationIDs config
      const orgIdentifiers = Array.from(new Set<string>(
        Object.values(entriesByInstance).flatMap(entries => entries.map(entry => entry.identifier))
      ))

      let existingOrgs: Organization[]
      try {
        existingOrgs = orgIdsResolved
          ? await getOrganizationsByNames(orgIdentifiers, paginator)
          : await getOrganizationsByIds(orgIdentifiers, client)
      } catch (e) {
        // If we fail for any reason, we don't want to block the user from deploying
        log.warn(`organizationExistenceValidator - Failed to get organizations from Zendesk: ${e.message}`)
        return []
      }

      const existingOrgsSet = new Set(
        existingOrgs.map(org => (orgIdsResolved ? org.name : org.id.toString())).filter(org => !_.isEmpty(org))
      )

      // Because 'entriesByInstance' is already grouped by instance, we can run over it instead of over the changes
      const errors = await awu(Object.values(entriesByInstance)).map(
        async (entries): Promise<ChangeError | undefined> => {
          const nonExistingOrgs = new Set<string>(
            entries.filter(({ identifier }) => !existingOrgsSet.has(identifier)).map(org => org.identifier)
          )

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
        }
      ).filter(isDefined).toArray()

      return errors
    }
