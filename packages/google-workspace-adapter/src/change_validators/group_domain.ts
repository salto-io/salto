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
import {
  ChangeError,
  ChangeValidator,
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isDomainExist } from '../fix_elements/replace_groups_domain'
import { DOMAIN_TYPE_NAME, GROUP_TYPE_NAME } from '../constants'
import { DEFAULT_PRIMARY_DOMAIN, UserConfig } from '../config'

const { awu } = collections.asynciterable

const domainNotExistError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Group domain does not exist in the environment.',
  detailedMessage: `The domain ${group.value.email} does not exist in the environment. You can manually update the domain of the group email or set the deploy defaultDomain configuration to an existing domain. Otherwise you can set the configuration to ${DEFAULT_PRIMARY_DOMAIN} in order to use the primary domain.`,
})

const domainsNotFetchedWarning = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Warning',
  message: 'Domains are excluded from the fetch, so the group domain cannot be validated.',
  detailedMessage: `The domain ${group.value.email} cannot be validated because domains are excluded from the fetch. If the domain exists in the environment, the deploy will fail.`,
})

/**
 * This CV warns if a group email is in a domain that does not exist in the deployed environment.
 */
export const groupDomainValidator =
  (config: UserConfig): ChangeValidator =>
  async (changes, elementSource) => {
    if (elementSource === undefined) {
      return []
    }
    const isDomainFetched = config.fetch.exclude.some(exclude => exclude.type === DOMAIN_TYPE_NAME)
    const domains = await awu(await elementSource.getAll())
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === DOMAIN_TYPE_NAME)
      .toArray()
    const noDomainError = isDomainFetched ? domainsNotFetchedWarning : domainNotExistError
    return changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(group => group.elemID.typeName === GROUP_TYPE_NAME)
      .filter(group => !isDomainExist(group, domains))
      .flatMap(instance => [noDomainError(instance)])
  }
