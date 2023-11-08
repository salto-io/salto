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

import { CORE_ANNOTATIONS, Change, InstanceElement, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { FORM_TYPE, JSM_DUCKTYPE_API_DEFINITIONS, PROJECT_TYPE, SERVICE_DESK } from '../../constants'
import { getCloudId } from '../automation/cloud_id'
import { createFormType, isCreateFormResponse, isDetailedFormsResponse, isFormsResponse } from './forms_types'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../../utils'

const { isDefined } = lowerDashValues
const { toBasicInstance } = elementUtils
const { getTransformationConfigByType } = configUtils
const deployForms = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const form = getChangeData(change)
  const project = getParent(form)
  if (form.value.design?.settings?.name === undefined) {
    throw new Error('Form name is missing')
  }
  const cloudId = await getCloudId(client)
  if (isAdditionOrModificationChange(change)) {
    if (isAdditionChange(change)) {
      const resp = await client.post({
        url: `/gateway/api/proforma/cloudid/${cloudId}/api/2/projects/${project.value.id}/forms`,
        data: {
          name: form.value.design.settings.name,
        },
      })
      if (!isCreateFormResponse(resp.data)) {
        return
      }
      form.value.id = resp.data.id
      form.value.design.settings.templateId = resp.data.id
    }
    await client.put({
      url: `/gateway/api/proforma/cloudid/${cloudId}/api/2/projects/${project.value.id}/forms/${form.value.id}`,
      data: form.value,
    })
  } else {
    await client.delete({
      url: `/gateway/api/proforma/cloudid/${cloudId}/api/1/projects/${project.value.id}/forms/${form.value.id}`,
    })
  }
}

/*
* This filter fetches all forms from Jira Service Management and creates an instance element for each form.
* We use filter because we need to use cloudId which is not available in the infrastructure.
*/
const filter: FilterCreator = ({ config, client, getElemIdFunc }) => ({
  name: 'formsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return
    }
    const cloudId = await getCloudId(client)
    const { formType, subTypes } = createFormType()
    setTypeDeploymentAnnotations(formType)
    await addAnnotationRecursively(formType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(formType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(formType, CORE_ANNOTATIONS.DELETABLE)
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
            if (!isDetailedFormsResponse(detailedRes.data)) {
              return undefined
            }
            const name = `${project.value.name}_${formResponse.name}`
            const formValue = detailedRes.data
            const jsmDuckTypeApiDefinitions = config[JSM_DUCKTYPE_API_DEFINITIONS]
            if (jsmDuckTypeApiDefinitions === undefined) {
              return undefined
            }
            return toBasicInstance({
              entry: formValue,
              type: formType,
              transformationConfigByType: getTransformationConfigByType(jsmDuckTypeApiDefinitions.types),
              transformationDefaultConfig: jsmDuckTypeApiDefinitions.typeDefaults.transformation,
              parent: project,
              // what ever default name you'd like
              defaultName: name,
              getElemIdFunc,
            })
          }))
      })))
      .flat()
      .filter(isDefined)
    forms.forEach(form => elements.push(form))
  },
  deploy: async changes => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [formsChanges, leftoverChanges] = _.partition(
      changes,
      (change): change is Change<InstanceElement> => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === FORM_TYPE
    )
    const deployResult = await deployChanges(formsChanges,
      async change => deployForms(change, client))

    return {
      leftoverChanges,
      deployResult,
    }
  },
})
export default filter
