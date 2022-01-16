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
import { Change, Element, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { resolveValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import JiraClient from '../client/client'
import { defaultDeployChange, deployChanges } from '../deployment'
import { getLookUpName } from '../reference_mapping'
import { FilterCreator } from '../filter'
import { findObject, setDeploymentAnnotations } from '../utils'

const log = logger(module)

const PROJECT_TYPE_NAME = 'Project'

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

  await deployScheme(instance, client, 'workflowScheme', 'workflowSchemeId')
  await deployScheme(instance, client, 'issueTypeScreenScheme', 'issueTypeScreenSchemeId')
  await deployScheme(instance, client, 'fieldConfigurationScheme', 'fieldConfigurationSchemeId')
  await deployScheme(instance, client, 'issueTypeScheme', 'issueTypeSchemeId')
}

/**
 * Restructures Project type to fit the deployment endpoint
 */
const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async (elements: Element[]) => {
    const projectType = findObject(elements, PROJECT_TYPE_NAME)
    if (projectType === undefined) {
      log.debug(`${PROJECT_TYPE_NAME} type not found`)
    } else {
      setDeploymentAnnotations(projectType, 'workflowScheme')
      setDeploymentAnnotations(projectType, 'issueTypeScreenScheme')
      setDeploymentAnnotations(projectType, 'fieldConfigurationScheme')
      setDeploymentAnnotations(projectType, 'issueTypeScheme')
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.leadAccountId = instance.value.lead?.accountId
        delete instance.value.lead

        instance.value.workflowScheme = instance.value.workflowScheme?.workflowScheme
          ?.id?.toString()
        instance.value.issueTypeScreenScheme = instance.value.issueTypeScreenScheme
          ?.issueTypeScreenScheme?.id
        instance.value.fieldConfigurationScheme = instance.value.fieldConfigurationScheme
          ?.fieldConfigurationScheme?.id
        instance.value.issueTypeScheme = instance.value.issueTypeScheme
          ?.issueTypeScheme?.id

        instance.value.notificationScheme = instance.value.notificationScheme?.id?.toString()
        instance.value.permissionScheme = instance.value.permissionScheme?.id?.toString()
      })
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === PROJECT_TYPE_NAME
        && isModificationChange(change)
    )


    const deployResult = await deployChanges(
      relevantChanges as Change<InstanceElement>[],
      async change => {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
          fieldsToIgnore: ['workflowScheme', 'issueTypeScreenScheme', 'fieldConfigurationScheme', 'issueTypeScheme'],
        })
        await deployProjectSchemes(change, client)
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
