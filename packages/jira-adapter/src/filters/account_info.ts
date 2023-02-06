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
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { JIRA, LICENSED_APPLICATION_TYPE, LICENSE_TYPE, ACCOUNT_INFO_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)

type LicenseResponse = {
  applications: [{
    id: string
    plan: string
  }]
}

const LICENSE_RESPONSE_SCHEME = Joi.object({
  applications: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    plan: Joi.string().required(),
  }).required()),
}).required()

const isLicenseResponse = createSchemeGuard<LicenseResponse>(LICENSE_RESPONSE_SCHEME, 'Received an invalid license response')

/*
 * Brings account info and stores it in an hidden nacl
 * the info includes license data
*/
const filter: FilterCreator = ({ client }) => ({
  name: 'account info filter',
  onFetch: async elements => {
    if (client.isDataCenter) {
      // Add here data center license info in the future
      return
    }
    const licensedApplications = new ObjectType({
      elemID: new ElemID(JIRA, LICENSED_APPLICATION_TYPE),
      isSettings: true,
      fields: {
        id: { refType: BuiltinTypes.STRING },
        plan: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      },
    })
    const licenseType = new ObjectType({
      elemID: new ElemID(JIRA, LICENSE_TYPE),
      isSettings: true,
      fields: {
        applications: { refType: new ListType(licensedApplications) },
      },
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      },
    })
    const accountInfoType = new ObjectType({
      elemID: new ElemID(JIRA, ACCOUNT_INFO_TYPE),
      isSettings: true,
      fields: {
        license: { refType: new ListType(licenseType) },
      },
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      },
    })
    try {
      const response = await client.getSinglePage({
        url: '/rest/api/3/instance/license',
      })
      if (!isLicenseResponse(response.data)) {
        throw new Error('Received an invalid license response')
      }
      const accountInfoInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        accountInfoType,
        {
          license: {
            applications: response.data.applications,
          },
        },
        undefined,
        { [CORE_ANNOTATIONS.HIDDEN]: true },
      )
      elements.push(licenseType, licensedApplications, accountInfoType, accountInfoInstance)
    } catch (e) {
      log.error(`Received an error when fetching jira license, ${e.message}.`)
    }
  },
})
export default filter
