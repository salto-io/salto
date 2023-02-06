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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FileProperties } from 'jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { VALIDATION_RULES_METADATA_TYPE } from '../../constants'
import { getAuthorAnnotations } from '../../transformers/transformer'
import { FilterWith, RemoteFilterCreator } from '../../filter'
import SalesforceClient from '../../client/client'
import { ensureSafeFilterFetch, isInstanceOfType } from '../utils'

const { isDefined } = values
const { awu } = collections.asynciterable
const log = logger(module)
const VALIDATION_RULES_API_NAME = 'ValidationRule'

const isValidationRulesInstance = isInstanceOfType(VALIDATION_RULES_METADATA_TYPE)

const getValidationRulesFileProperties = async (client: SalesforceClient):
  Promise<FileProperties[]> => {
  const { result, errors } = await client.listMetadataObjects({ type: VALIDATION_RULES_API_NAME })
  if (errors && errors.length > 0) {
    log.warn(`Encountered errors while listing file properties for SharingRules: ${errors}`)
  }
  return result
}


const fetchAllValidationRules = async (
  client: SalesforceClient
): Promise<Record<string, FileProperties>> => {
  const allRules = await getValidationRulesFileProperties(client)
  return _.keyBy(allRules, 'fullName')
}

export const WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

/*
 * Add author information to validation rules instances.
 */
const filterCreator: RemoteFilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
  name: 'validationRulesAuthorFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'authorInformation',
    fetchFilterFunc: async (elements: Element[]) => {
      const ValidationRulesMap = await fetchAllValidationRules(client)
      const validationRulesInstances = await (awu(elements)
        .filter(isInstanceElement)
        .filter(isValidationRulesInstance)
        .toArray())
      validationRulesInstances.forEach(validationRule => {
        if (isDefined(ValidationRulesMap[validationRule.value.fullName])) {
          validationRule.annotate(
            getAuthorAnnotations(ValidationRulesMap[validationRule.value.fullName]),
          )
        }
      })
    },
  }),
})

export default filterCreator
