/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import setFileCabinetUrls from '../service_url/file_cabinet'
import setScriptsUrls from '../service_url/script'
import setCustomFieldsUrls from '../service_url/custom_field'
import setCustomRecordTypesUrls from '../service_url/custom_record_type'
import setCustomTransactionTypesUrls from '../service_url/custom_transaction_type'
import setEmailTemplatesUrls from '../service_url/emailtemplate'
import setRoleUrls from '../service_url/role'
import setSublistsUrls from '../service_url/sublist'
import setSavedSearchUrls from '../service_url/savedsearch'
import setConstantUrls from '../service_url/constant_urls'

const log = logger(module)

const SERVICE_URL_SETTERS = [
  setFileCabinetUrls,
  setScriptsUrls,
  setCustomFieldsUrls,
  setCustomRecordTypesUrls,
  setCustomTransactionTypesUrls,
  setEmailTemplatesUrls,
  setRoleUrls,
  setSublistsUrls,
  setSavedSearchUrls,
  setConstantUrls,
]

const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements, client }) => {
    if (!client.isSuiteAppConfigured()) {
      return
    }

    log.debug('Start fetching service urls')
    await Promise.all(SERVICE_URL_SETTERS.map(setter => setter(elements, client)))
    log.debug('Finished fetching service urls')
  },
})

export default filterCreator
