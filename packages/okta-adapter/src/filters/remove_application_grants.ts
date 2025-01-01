/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceChange, getChangeData, isRemovalOrModificationChange } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { definitions as definitionsUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { APPLICATION_TYPE_NAME, OKTA } from '../constants'
import { FilterCreator } from '../filter'
import { OktaOptions } from '../definitions/types'

const log = logger(module)
const { awu } = collections.asynciterable

/**
 * When removing an application grant, the removed grant id must be provided.
 * As the grant id is not persisted on the element, we make an API request to get the current grants and ids.
 */
const filterCreator: FilterCreator = ({ sharedContext, definitions }) => ({
  name: 'removedApplicationGrants',
  preDeploy: async changes => {
    const requester = fetchUtils.request.getRequester<OktaOptions>({
      adapterName: OKTA,
      clients: definitions.clients,
      pagination: definitions.pagination,
      requestDefQuery: definitionsUtils.queryWithDefault(
        definitionsUtils.getNestedWithDefault(definitions.fetch?.instances ?? {}, 'requests'),
      ),
    })
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isRemovalOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .forEach(async instance => {
        const { id } = instance.value
        try {
          const response = await requester.requestAllForResource({
            callerIdentifier: { typeName: 'OAuth2ScopeConsentGrant' },
            contextPossibleArgs: { appId: [id] },
          })
          const oAuth2ScopeConsentGrantsResponse = response.map(({ value }) => ({
            [_.get(value, 'scopeId')]: _.get(value, 'id'),
          }))
          _.assign(sharedContext, { [instance.elemID.getFullName()]: _.merge({}, ...oAuth2ScopeConsentGrantsResponse) })
        } catch (e) {
          log.error(
            'Failed to fetch oAuth2ScopeConsentGrants for %s: %s',
            instance.elemID.getFullName(),
            safeJsonStringify(e.message),
          )
        }
      })
  },
})

export default filterCreator
