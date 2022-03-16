/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, Element, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { resolveValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import JiraClient from '../client/client'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { getLookUpName } from '../reference_mapping'
import { FilterCreator } from '../filter'
import { findObject, setFieldDeploymentAnnotations } from '../utils'

const PROJECT_TYPE_NAME = 'Project'

const WORKFLOW_SCHEME_FIELD = 'workflowScheme'
const COMPONENTS_FIELD = 'components'
const ISSUE_TYPE_SCREEN_SCHEME_FIELD = 'issueTypeScreenScheme'
const FIELD_CONFIG_SCHEME_FIELD = 'fieldConfigurationScheme'
const ISSUE_TYPE_SCHEME = 'issueTypeScheme'

const deployScheme = async (
  instance: InstanceElement,
  client: JiraClient,
  schemeInstanceField: string,
  schemeBodyField: string,
): Promise<void> => {
  if (instance.value[schemeInstanceField] !== undefined) {
    await client.put({
      url: `/rest/api/3/${schemeInstanceField.toLowerCase()}/project`,
      data: {
        [schemeBodyField]: instance.value[schemeInstanceField],
        projectId: instance.value.id,
      },
    })
  }
}

const deployProjectSchemes = async (
  projectChange: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const instance = await resolveValues(getChangeData(projectChange), getLookUpName)

  await deployScheme(instance, client, WORKFLOW_SCHEME_FIELD, 'workflowSchemeId')
  await deployScheme(instance, client, ISSUE_TYPE_SCREEN_SCHEME_FIELD, 'issueTypeScreenSchemeId')
  await deployScheme(instance, client, FIELD_CONFIG_SCHEME_FIELD, 'fieldConfigurationSchemeId')
  await deployScheme(instance, client, ISSUE_TYPE_SCHEME, 'issueTypeSchemeId')
}

/**
 * Restructures Project type to fit the deployment endpoint
 */
const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async (elements: Element[]) => {
    const projectType = findObject(elements, PROJECT_TYPE_NAME)
    if (projectType !== undefined) {
      setFieldDeploymentAnnotations(projectType, WORKFLOW_SCHEME_FIELD)
      setFieldDeploymentAnnotations(projectType, ISSUE_TYPE_SCREEN_SCHEME_FIELD)
      setFieldDeploymentAnnotations(projectType, FIELD_CONFIG_SCHEME_FIELD)
      setFieldDeploymentAnnotations(projectType, ISSUE_TYPE_SCHEME)
      setFieldDeploymentAnnotations(projectType, COMPONENTS_FIELD)
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.leadAccountId = instance.value.lead?.accountId
        delete instance.value.lead

        instance.value[WORKFLOW_SCHEME_FIELD] = instance
          .value[WORKFLOW_SCHEME_FIELD]?.[WORKFLOW_SCHEME_FIELD]?.id?.toString()
        instance.value.issueTypeScreenScheme = instance
          .value[ISSUE_TYPE_SCREEN_SCHEME_FIELD]?.[ISSUE_TYPE_SCREEN_SCHEME_FIELD]?.id
        instance.value.fieldConfigurationScheme = instance
          .value[FIELD_CONFIG_SCHEME_FIELD]?.[FIELD_CONFIG_SCHEME_FIELD]?.id
        instance.value[ISSUE_TYPE_SCHEME] = instance
          .value[ISSUE_TYPE_SCHEME]?.[ISSUE_TYPE_SCHEME]?.id

        instance.value.notificationScheme = instance.value.notificationScheme?.id?.toString()
        instance.value.permissionScheme = instance.value.permissionScheme?.id?.toString()
        instance.value.issueSecurityScheme = instance.value.issueSecurityScheme?.id?.toString()
      })
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === PROJECT_TYPE_NAME
        && isAdditionOrModificationChange(change)
    )


    const deployResult = await deployChanges(
      relevantChanges as Change<InstanceElement>[],
      async change => {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
          fieldsToIgnore: isModificationChange(change)
            ? [COMPONENTS_FIELD,
              WORKFLOW_SCHEME_FIELD,
              ISSUE_TYPE_SCREEN_SCHEME_FIELD,
              FIELD_CONFIG_SCHEME_FIELD,
              ISSUE_TYPE_SCHEME]
            : [COMPONENTS_FIELD],
        })
        if (isModificationChange(change)) {
          await deployProjectSchemes(change, client)
        }
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },

  onDeploy: async (changes: Change<Element>[]) => {
    changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.id = instance.value.id?.toString()
      })
  },
})

export default filter
