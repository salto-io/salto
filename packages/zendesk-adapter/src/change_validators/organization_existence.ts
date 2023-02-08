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
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import {
  createOrganizationPathEntryByOrgRef, getOrganizationsByNames,
  TYPE_NAME_TO_REPLACER,
} from '../filters/organizations'
import ZendeskClient from '../client/client'
import { paginate } from '../client/pagination'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues

const organizationsCache: Record<string, boolean> = {}

// Request the organization by name and cache the result in order to save api calls
export const doesOrganizationExists = async (paginator: clientUtils.Paginator, orgName: string): Promise<boolean> => {
  if (organizationsCache[orgName] !== undefined) {
    return organizationsCache[orgName]
  }

  const organizations = await getOrganizationsByNames([orgName], paginator, true)
  // requesting organization returns all organizations that starts with the requested name, we want to cache them all
  organizations.forEach(org => { organizationsCache[org.name] = true })

  if (organizationsCache[orgName] === undefined) {
    organizationsCache[orgName] = false
  }
  return organizationsCache[orgName]
}

/**
 * Validates the existence of organizations that are referenced in added or modified elements
 */
export const organizationExistenceValidator: (client: ZendeskClient) =>
    ChangeValidator = client => async changes => {
      const relevantChanges = changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).filter(change =>
        Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName))

      const organizationPathEntryByOrgId = createOrganizationPathEntryByOrgRef(relevantChanges.map(getChangeData))

      const instancesToOrganizations: Record<string, {orgs: Set<string>; instance: InstanceElement}> = {}
      // Organize the results by instance to all organizations that exists in it
      Object.values(organizationPathEntryByOrgId).flat().forEach(({ instance, id: orgName }) => {
        const instanceName = instance.elemID.getFullName()
        const organizationNames = instancesToOrganizations[instanceName]?.orgs ?? new Set<string>()
        organizationNames.add(orgName)

        instancesToOrganizations[instanceName] = { orgs: organizationNames, instance }
      })

      const paginator = clientUtils.createPaginator({ client, paginationFuncCreator: paginate })
      const errors = await awu(Object.values(instancesToOrganizations)).map(async ({ orgs, instance })
          : Promise<ChangeError| undefined> => {
        const nonExistingOrgs = await awu(orgs).filter(async org => !await doesOrganizationExists(paginator, org))
          .toArray()

        // If the instance includes an organization that does not exist, we won't allow a change to that instance
        if (nonExistingOrgs.length > 0) {
          return {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Referenced organizations do not exist',
            detailedMessage: `The following referenced organizations does not exist: ${nonExistingOrgs.join(', ')}`,
          }
        }
        return undefined
      }).filter(isDefined).toArray()

      return errors
    }
