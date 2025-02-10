/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FileProperties } from '@salto-io/jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { inspectValue } from '@salto-io/adapter-utils'
import { SHARING_RULES_TYPE } from '../../constants'
import { getAuthorAnnotations } from '../../transformers/transformer'
import { FilterCreator } from '../../filter'
import SalesforceClient from '../../client/client'
import { ensureSafeFilterFetch, isInstanceOfType } from '../utils'

const { isDefined } = values
const { awu } = collections.asynciterable
const log = logger(module)
export const SHARING_RULES_API_NAMES = ['SharingCriteriaRule', 'SharingGuestRule', 'SharingOwnerRule'] as const

const isSharingRulesInstance = isInstanceOfType(SHARING_RULES_TYPE)
const getRuleObjectName = (fileProperties: FileProperties): string => fileProperties.fullName.split('.')[0]

const getSharingRulesFileProperties = async (client: SalesforceClient): Promise<FileProperties[]> => {
  const { result, errors } = await client.listMetadataObjects(
    SHARING_RULES_API_NAMES.map(ruleType => ({ type: ruleType })),
  )
  if (errors && errors.length > 0) {
    log.warn('Encountered errors while listing file properties for SharingRules: %s', inspectValue(errors))
  }
  return result
}

const fetchAllSharingRules = async (client: SalesforceClient): Promise<Record<string, FileProperties[]>> => {
  const allRules = await getSharingRulesFileProperties(client)
  return _.groupBy(allRules.flat(), fileProp => getRuleObjectName(fileProp))
}

const getLastSharingRuleFileProperties = (
  sharingRules: InstanceElement,
  sharingRulesMap: Record<string, FileProperties[]>,
): FileProperties => {
  const rules = _.sortBy(sharingRulesMap[sharingRules.value.fullName], fileProp =>
    Date.parse(fileProp.lastModifiedDate),
  )
  return rules[rules.length - 1]
}

const WARNING_MESSAGE =
  'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

/*
 * add author information to sharing rules instances.
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'sharingRulesAuthorFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements: Element[]) => {
      if (client === undefined) {
        return
      }

      const sharingRulesMap = await fetchAllSharingRules(client)
      const sharingRulesInstances = await awu(elements)
        .filter(isInstanceElement)
        .filter(isSharingRulesInstance)
        .toArray()
      sharingRulesInstances.forEach(sharingRules => {
        const lastRuleFileProp = getLastSharingRuleFileProperties(sharingRules, sharingRulesMap)
        if (isDefined(lastRuleFileProp)) {
          const ruleAuthorInformation = getAuthorAnnotations(lastRuleFileProp)
          delete ruleAuthorInformation[CORE_ANNOTATIONS.CREATED_AT]
          delete ruleAuthorInformation[CORE_ANNOTATIONS.CREATED_BY]
          sharingRules.annotate(getAuthorAnnotations(lastRuleFileProp))
        }
      })
    },
  }),
})

export default filterCreator
