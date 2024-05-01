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

import { FixElementsHandler } from '@salto-io/adapter-components'
import { ChangeError, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { DEFAULT_PRIMARY_DOMAIN, UserConfig } from '../config'
import { Options } from '../definitions/types'
import { DOMAIN_TYPE_NAME, GROUP_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const domainNotExistError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Group Domain does not exist in the target environment',
  detailedMessage: `The domain of the group ${group.value.name} does not exist in the target environment. You can manually update the domain of the group to an existing domain or set the default domain in the deploy defaultDomain configuration to ${DEFAULT_PRIMARY_DOMAIN} to use the primary domain.`,
})

const noPrimaryError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Could not find a primary domain',
  detailedMessage: `Could not find a primary domain to use in the ${group.value.name} group. You can manually update the domain of the group to an existing domain or set the default domain in the deploy defaultDomain configuration with existing domain.`,
})

const replaceDomainInfo = (group: InstanceElement, domain: string): ChangeError => ({
  elemID: group.elemID,
  severity: 'Info',
  message: `replaced to domain of the ${group.value.name} group to ${domain}`,
  detailedMessage: `replaced to domain of the ${group.value.name} group to ${domain}`,
})

const isDomainExist = (group: InstanceElement, domains: InstanceElement[]): boolean => {
  const domainName = group.value.email.split('@')[1]
  return domains.some(domain => domain.value.domainName === domainName)
}

const replaceGroupDomain = (group: InstanceElement, domain: string): InstanceElement => {
  const clone = group.clone()
  const emailPrefix = clone.value.email.split('@')[0]
  clone.value.email = `${emailPrefix}@${domain}`
  return clone
}

export const replaceGroupsDomainHandler: FixElementsHandler<Options, UserConfig> =
  ({ config, elementsSource }) =>
  async elements => {
    const defaultDomain = config.deploy?.defaultDomain
    const groups = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === GROUP_TYPE_NAME)
    const domains = await awu(await elementsSource.getAll())
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === DOMAIN_TYPE_NAME)
      .toArray()
    if (groups.length === 0) {
      return { errors: [], fixedElements: [] }
    }
    const groupsWithNoDomain = groups.filter(group => !isDomainExist(group, domains))
    if (defaultDomain === '') {
      const nonExistErrors = groupsWithNoDomain.map(group => domainNotExistError(group))
      return { errors: nonExistErrors, fixedElements: [] }
    }
    const primaryDomain = domains.find(domain => domain.value.isPrimary === true)
    if (defaultDomain === DEFAULT_PRIMARY_DOMAIN && !primaryDomain) {
      return { errors: groupsWithNoDomain.map(noPrimaryError), fixedElements: [] }
    }
    const domainReplacement = defaultDomain === DEFAULT_PRIMARY_DOMAIN ? primaryDomain?.value.domainName : defaultDomain
    const fixedElements = groupsWithNoDomain.map(group => replaceGroupDomain(group, domainReplacement))
    const errors = fixedElements.map(group => replaceDomainInfo(group, domainReplacement))
    return {
      errors,
      fixedElements: [],
    }
  }
