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

import {
  CORE_ANNOTATIONS,
  Change,
  InstanceElement,
  ReferenceExpression,
  SaltoError,
  SeverityLevel,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getParent, invertNaclCase, mapKeysRecursive, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { resolveValues } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { FORM_TYPE, JSM_DUCKTYPE_API_DEFINITIONS, PROJECT_TYPE, SERVICE_DESK } from '../../constants'
import { getCloudId } from '../automation/cloud_id'
import { createFormType, isCreateFormResponse, isDetailedFormsResponse, isFormsResponse } from './forms_types'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../../utils'
import { getLookUpName } from '../../reference_mapping'

const { isDefined } = lowerDashValues

const deployForms = async (change: Change<InstanceElement>, client: JiraClient): Promise<void> => {
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
        throw new Error('Failed to create form')
      }
      form.value.id = resp.data.id
      form.value.design.settings.templateId = resp.data.id
    }
    const resolvedForm = await resolveValues(form, getLookUpName)
    const data = mapKeysRecursive(resolvedForm.value, ({ key }) => invertNaclCase(key))
    // RequestType Id is a string, but the forms API expects a number
    if (Array.isArray(data.publish?.portal?.portalRequestTypeIds)) {
      data.publish.portal.portalRequestTypeIds = data.publish.portal.portalRequestTypeIds.map((id: string) =>
        Number(id),
      )
    }
    await client.put({
      url: `/gateway/api/proforma/cloudid/${cloudId}/api/2/projects/${project.value.id}/forms/${form.value.id}`,
      data,
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
const filter: FilterCreator = ({ config, client, fetchQuery }) => ({
  name: 'formsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || client.isDataCenter || !fetchQuery.isTypeMatch(FORM_TYPE)) {
      return { errors: [] }
    }
    const cloudId = await getCloudId(client)
    const { formType, subTypes } = createFormType()
    setTypeDeploymentAnnotations(formType)
    await addAnnotationRecursively(formType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(formType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(formType, CORE_ANNOTATIONS.DELETABLE)
    elements.push(formType)
    subTypes.forEach(subType => {
      elements.push(subType)
    })

    const jsmProjects = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .filter(project => project.value.projectTypeKey === SERVICE_DESK)

    const errors: SaltoError[] = []
    const forms = (
      await Promise.all(
        jsmProjects.flatMap(async project => {
          const url = `/gateway/api/proforma/cloudid/${cloudId}/api/1/projects/${project.value.id}/forms`
          const res = await client.get({ url })
          if (!isFormsResponse(res)) {
            return undefined
          }
          return Promise.all(
            res.data.map(async formResponse => {
              const detailedUrl = `/gateway/api/proforma/cloudid/${cloudId}/api/2/projects/${project.value.id}/forms/${formResponse.id}`
              const detailedRes = await client.get({ url: detailedUrl })
              if (!isDetailedFormsResponse(detailedRes.data)) {
                const error = {
                  message: `Unable to fetch form for project ${project.elemID.name} as it is missing a title.`,
                  severity: 'Warning' as SeverityLevel,
                }
                errors.push(error)
                return undefined
              }
              const name = naclCase(`${project.value.key}_${formResponse.name}`)
              const formValue = detailedRes.data
              const parentPath = project.path ?? []
              const jsmDuckTypeApiDefinitions = config[JSM_DUCKTYPE_API_DEFINITIONS]
              if (jsmDuckTypeApiDefinitions === undefined) {
                return undefined
              }
              return new InstanceElement(
                name,
                formType,
                formValue,
                [...parentPath.slice(0, -1), 'forms', pathNaclCase(name)],
                {
                  [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(project.elemID, project)],
                },
              )
            }),
          )
        }),
      )
    )
      .flat()
      .filter(isDefined)
    forms.forEach(form => {
      form.value = mapKeysRecursive(form.value, ({ key }) => naclCase(key))
      elements.push(form)
    })

    return { errors }
  },
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(change => getChangeData(change))
      .filter(instance => instance.elemID.typeName === FORM_TYPE)
      .forEach(instance => {
        instance.value.updated = new Date().toISOString()
      })
  },
  deploy: async changes => {
    if (!config.fetch.enableJSM || client.isDataCenter) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [formsChanges, leftoverChanges] = _.partition(
      changes,
      (change): change is Change<InstanceElement> =>
        isInstanceChange(change) && getChangeData(change).elemID.typeName === FORM_TYPE,
    )
    const deployResult = await deployChanges(formsChanges, async change => deployForms(change, client))

    return {
      leftoverChanges,
      deployResult,
    }
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(change => getChangeData(change))
      .filter(instance => instance.elemID.typeName === FORM_TYPE)
      .forEach(instance => {
        delete instance.value.updated
      })
  },
})
export default filter
