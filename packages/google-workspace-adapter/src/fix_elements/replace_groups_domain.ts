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

import { FixElementsHandler, fetch } from '@salto-io/adapter-components'
import { ChangeError, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { DEFAULT_PRIMARY_DOMAIN, UserConfig } from '../config'
import { Options } from '../definitions/types'
import { DOMAIN_TYPE_NAME, GROUP_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const replaceDomainInfo = (group: InstanceElement, domain: string): ChangeError => ({
  elemID: group.elemID,
  severity: 'Info',
  message: `Replaced the domain of group ${group.value.name} with ${domain}.`,
  detailedMessage: `Replaced the domain of group ${group.value.name} with ${domain}.`,
})

export const isDomainExist = (group: InstanceElement, domains: InstanceElement[]): boolean => {
  const groupEmail = group.value.email
  if (groupEmail === undefined || groupEmail.split('@').length !== 2) {
    log.error(`Group ${group.value.name} has an invalid email: ${groupEmail}`)
    return true
  }
  const domainName = group.value.email.split('@')[1]
  return domains.some(domain => domain.value.domainName === domainName)
}

const replaceGroupDomain = (group: InstanceElement, domain: string): InstanceElement => {
  const clone = group.clone()
  const username = clone.value.email.split('@')[0]
  clone.value.email = `${username}@${domain}`
  return clone
}

/**
 * If a group email is in a domain that does not exist in the current environment,
 * the function will replace the domain with the default domain.
 */
export const replaceGroupsDomainHandler: FixElementsHandler<Options, UserConfig> =
  ({ config, elementsSource }) =>
  async elements => {
    const defaultDomain = config.deploy?.defaultDomain
    if (defaultDomain === undefined) {
      return { errors: [], fixedElements: [] }
    }
    const groups = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === GROUP_TYPE_NAME)
    if (groups.length === 0) {
      return { errors: [], fixedElements: [] }
    }

    const fetchQuery = fetch.query.createElementQuery(config.fetch)
    const isDomainsFetched = fetchQuery.isTypeMatch(DOMAIN_TYPE_NAME)
    if (!isDomainsFetched) {
      // If domains are not fetched, we cannot validate the domain and fix them
      // The group_domain CV will warn about it
      return { errors: [], fixedElements: [] }
    }

    const domains = await awu(await elementsSource.getAll())
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === DOMAIN_TYPE_NAME)
      .toArray()
    const groupsWithNoDomain = groups.filter(group => !isDomainExist(group, domains))

    const primaryDomain = domains.find(domain => domain.value.isPrimary === true)
    if (defaultDomain === DEFAULT_PRIMARY_DOMAIN && !primaryDomain) {
      return { errors: [], fixedElements: [] }
    }
    const domainReplacement = defaultDomain === DEFAULT_PRIMARY_DOMAIN ? primaryDomain?.value.domainName : defaultDomain
    const fixedElements = groupsWithNoDomain.map(group => replaceGroupDomain(group, domainReplacement))
    const errors = fixedElements.map(group => replaceDomainInfo(group, domainReplacement))
    return {
      errors,
      fixedElements,
    }
  }
