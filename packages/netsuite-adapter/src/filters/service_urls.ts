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
import { CORE_ANNOTATIONS, Element, getChangeData, isAdditionChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import NetsuiteClient from '../client/client'
import { RemoteFilterCreator } from '../filter'
import setConstantUrls from '../service_url/constant_urls'
import setCustomFieldsUrls from '../service_url/custom_field'
import setCustomRecordTypesUrls from '../service_url/custom_record_type'
import setCustomSegmentUrls from '../service_url/custom_segment'
import setCustomTransactionTypesUrls from '../service_url/custom_transaction_type'
import setEmailTemplatesUrls from '../service_url/emailtemplate'
import setFileCabinetUrls from '../service_url/file_cabinet'
import setRoleUrls from '../service_url/role'
import setSavedSearchUrls from '../service_url/savedsearch'
import setScriptsUrls from '../service_url/script'
import setSublistsUrls from '../service_url/sublist'
import setSuiteAppUrls from '../service_url/suiteapp_elements_url'

const log = logger(module)
const { awu } = collections.asynciterable

const SERVICE_URL_SETTERS = {
  setFileCabinetUrls,
  setScriptsUrls,
  setCustomFieldsUrls,
  setCustomRecordTypesUrls,
  setCustomSegmentUrls,
  setCustomTransactionTypesUrls,
  setEmailTemplatesUrls,
  setRoleUrls,
  setSublistsUrls,
  setSavedSearchUrls,
  setSuiteAppUrls,
}

const setServiceUrls = async (elements: Element[], client: NetsuiteClient): Promise<void> => {
  // setConstantUrls should run last
  await awu(Object.entries(SERVICE_URL_SETTERS).concat([[setConstantUrls.name, setConstantUrls]])).forEach(
    ([setterName, setter]) => log.time(() => setter(elements, client), `serviceUrls.${setterName}`),
  )
}

const filterCreator: RemoteFilterCreator = ({ client }) => ({
  name: 'serviceUrls',
  remote: true,
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    await setServiceUrls(elements, client)
  },
  preDeploy: async changes => {
    changes.map(getChangeData).forEach(element => {
      delete element.annotations[CORE_ANNOTATIONS.SERVICE_URL]
    })
  },
  /**
   * This assigns the service URLs for new instances created through Salto
   */
  onDeploy: async changes => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const additionChanges = changes.filter(isAdditionChange).map(getChangeData)
    if (additionChanges.length === 0) {
      return
    }
    await setServiceUrls(additionChanges, client)
  },
})

export default filterCreator
