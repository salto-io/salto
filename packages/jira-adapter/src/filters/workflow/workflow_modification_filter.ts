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
import { logger } from '@salto-io/logging'
import { AdditionChange, CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceChange, isModificationChange, isReferenceExpression, ModificationChange, ReadOnlyElementsSource, ReferenceExpression, RemovalChange, toChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { transformElement } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { WORKFLOW_SCHEME_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../constants'
import { addUpdatableAnnotationRecursively, findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { deployWorkflow } from './workflow_deploy_filter'
import { deployWorkflowScheme, preDeployWorkflowScheme } from '../workflow_scheme'


const { awu } = collections.asynciterable

const log = logger(module)

const replaceWorkflowInScheme = async (
  scheme: InstanceElement,
  beforeWorkflow: InstanceElement,
  afterWorkflow: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement | undefined> => {
  let wasChanged = false
  const instance = await transformElement({
    element: scheme,
    strict: false,
    elementsSource,
    transformFunc: ({ value }) => {
      if (isReferenceExpression(value) && value.elemID.isEqual(beforeWorkflow.elemID)) {
        wasChanged = true
        return new ReferenceExpression(afterWorkflow.elemID, afterWorkflow)
      }
      return value
    },
  })

  return wasChanged ? instance : undefined
}

const deployWorkflowModification = async ({
  change,
  client,
  paginator,
  config,
  workflowSchemes,
  elementsSource,
}: {
  change: ModificationChange<InstanceElement>
  client: JiraClient
  paginator: clientUtils.Paginator
  config: JiraConfig
  workflowSchemes: InstanceElement[]
  elementsSource: ReadOnlyElementsSource
}): Promise<void> => {
  const originalInstance = getChangeData(change)
  const tempInstance = originalInstance.clone()
  tempInstance.value.name = `${tempInstance.value.name}-${uuidv4()}`

  const workflowSchemesWithTemp = await awu(workflowSchemes)
    .map(scheme => replaceWorkflowInScheme(
      scheme,
      originalInstance,
      tempInstance,
      elementsSource,
    ))
    .filter(values.isDefined)
    .toArray()

  const cleanTempInstance = async (): Promise<void> => {
    const updateWorkflowSchemes = await awu(workflowSchemesWithTemp)
      .map(scheme => replaceWorkflowInScheme(
        scheme, tempInstance, originalInstance, elementsSource
      ))
      .filter(values.isDefined)
      .toArray()

    await awu(updateWorkflowSchemes).forEach(async scheme => {
      await preDeployWorkflowScheme(scheme, 'modify', elementsSource)
      try {
        await deployWorkflowScheme(
          toChange({ before: scheme, after: scheme }),
          client,
          paginator,
          config,
          elementsSource,
        )
      } catch (err) {
        log.error(`Error while cleaning up temp workflow ${tempInstance.elemID.getFullName()} from workflow scheme ${scheme.elemID.getFullName()}: ${err}`)
      }
    })

    try {
      await deployWorkflow(
        toChange({ before: tempInstance }) as RemovalChange<InstanceElement>,
        client,
        config,
      )
    } catch (err) {
      log.error(`Error while removing temp workflow ${tempInstance.elemID.getFullName()}: ${err}`)
    }
  }

  await deployWorkflow(
    toChange({ after: tempInstance }) as AdditionChange<InstanceElement>,
    client,
    config
  )

  try {
    await awu(workflowSchemesWithTemp).forEach(async scheme => {
      await preDeployWorkflowScheme(scheme, 'modify', elementsSource)
      await deployWorkflowScheme(
        toChange({ before: scheme, after: scheme }),
        client,
        paginator,
        config,
        elementsSource,
      )
    })
  } catch (err) {
    await cleanTempInstance()
    if (err.response?.data?.errorMessages.some((message: string) => message.includes('is missing the mappings required for statuses with IDs'))) {
      throw new Error(`Modification to an active workflow ${getChangeData(change).elemID.getFullName()} is not backward compatible`)
    }
    throw err
  }

  await deployWorkflow(
    toChange({ before: change.data.before }) as RemovalChange<InstanceElement>,
    client,
    config
  )

  await deployWorkflow(
    toChange({ after: change.data.after }) as AdditionChange<InstanceElement>,
    client,
    config
  )

  await cleanTempInstance()
}

const filter: FilterCreator = ({ client, config, elementsSource, paginator }) => ({
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping workflow modification filter because private API is not enabled')

      return
    }
    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType !== undefined) {
      workflowType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      await addUpdatableAnnotationRecursively(workflowType)
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isModificationChange(change)
        && getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME
    )

    const workflowSchemes = await awu(await elementsSource.list())
      .filter(id => id.typeName === WORKFLOW_SCHEME_TYPE_NAME)
      .map(id => elementsSource.get(id))
      .toArray()

    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isModificationChange),
      async change => deployWorkflowModification({
        change,
        client,
        paginator,
        config,
        workflowSchemes,
        elementsSource,
      }),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
