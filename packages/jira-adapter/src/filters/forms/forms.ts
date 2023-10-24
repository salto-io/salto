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
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { JIRA, PROJECT_TYPE, SERVICE_DESK } from '../../constants'
import { getCloudId } from '../automation/cloud_id'
import { createFormType, isDetailedFormsResponse, isFormsResponse } from './forms_types'

const { isDefined } = lowerDashValues

/*
* This filter fetches all forms from Jira Service Management and creates an instance element for each form.
* We use filter because we need to use cloudId which is not available in the infrastructure.
*/
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

    const jsmProjects = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .filter(project => project.value.projectTypeKey === SERVICE_DESK)

    const forms = (await Promise.all(jsmProjects
      .flatMap(async project => {
        const url = `/gateway/api/proforma/cloudid/${cloudId}/api/1/projects/${project.value.id}/forms`
        const res = await client.getSinglePage({ url })
        if (!isFormsResponse(res)) {
          return undefined
        }
        return Promise.all(res.data
          .map(async formResponse => {
            const detailedUrl = `/gateway/api/proforma/cloudid/${cloudId}/api/2/projects/${project.value.id}/forms/${formResponse.id}`
            const detailedRes = await client.getSinglePage({ url: detailedUrl })
            if (!isDetailedFormsResponse(detailedRes)) {
              return undefined
            }
            const name = `${project.value.name}_${formResponse.name}`
            const formValue = detailedRes.data
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
          }))
      })))
      .flat()
      .filter(isDefined)
    forms.forEach(form => elements.push(form))
  },
})
export default filter
