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

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { JIRA, PROJECT_TYPE } from '../../constants'
import { getCloudId } from '../automation/cloud_id'
import { DETAILED_FORM_RESPONSE_SCHEME, FORMS_RESPONSE_SCHEME, createFormType, detailedFormResponse, formsResponse } from './forms_types'

const { isDefined } = lowerDashValues

const isFormsResponse = createSchemeGuard<formsResponse>(FORMS_RESPONSE_SCHEME)
const isDetailedFormsResponse = createSchemeGuard<detailedFormResponse>(DETAILED_FORM_RESPONSE_SCHEME)

const filter: FilterCreator = ({ config, client, getElemIdFunc }) => ({
  name: 'formsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const cloudId = await getCloudId(client)
    const { formType, subTypes } = createFormType()
    elements.push(formType)
    subTypes.forEach(subType => { elements.push(subType) })

    const jsmProject = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === PROJECT_TYPE)
      .filter(e => e.value.projectTypeKey === 'service_desk')

    const forms = (await Promise.all(jsmProject.flatMap(async project => {
      const url = `/gateway/api/proforma/cloudid/${cloudId}/api/1/projects/${project.value.id}/forms`
      const res = await client.getSinglePage({ url })
      if (isFormsResponse(res)) {
        return Promise.all(res.data.map(async formResponse => {
          const detailedUrl = `/gateway/api/proforma/cloudid/${cloudId}/api/2/projects/${project.value.id}/forms/${formResponse.id}`
          const detailedRes = await client.getSinglePage({ url: detailedUrl })
          if (isDetailedFormsResponse(detailedRes)) {
            const name = `${project.value.name}_${formResponse.name}`
            delete detailedRes.data?.publish
            delete detailedRes.data.design.settings.templateFormUuid
            detailedRes.data.design.questions = Object.values(detailedRes.data.design.questions)
            detailedRes.data.design.sections = Object.values(detailedRes.data.design.sections)
            detailedRes.data.design.conditions = Object.values(detailedRes.data.design.conditions)
            const formValue = detailedRes.data
            formValue.id = formResponse.id
            const serviceIds = adapterElements.createServiceIds(formValue, 'uuid', formType.elemID)
            const instanceName = getElemIdFunc ? getElemIdFunc(JIRA, serviceIds, naclCase(name)).name
              : naclCase(name)
            const prefixPath = project.path ?? []
            return new InstanceElement(
              instanceName,
              formType,
              formValue,
              [...prefixPath.slice(0, -1), 'forms', pathNaclCase(instanceName)],
            )
          }
          return undefined
        }))
      }
      return undefined
    }))).flat().filter(isDefined)
    forms.forEach(form => elements.push(form))
  },
})
export default filter
