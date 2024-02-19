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
  AdditionChange,
  Element,
  InstanceElement,
  SaltoElementError,
  createSaltoElementError,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getParent, hasValidParent } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FilterCreator } from '../../filter'
import { deployContextChange, setContextDeploymentAnnotations } from './contexts'
import { deployChanges } from '../../deployment/standard_deployment'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME, IS_LOCKED, SERVICE } from './constants'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { isRelatedToSpecifiedTerms } from '../../change_validators/locked_fields'
import JiraClient from '../../client/client'

const log = logger(module)

type ContextParams = {
  id: string
  name: string
}

type ContextGetResponse = {
  values: ContextParams[]
}
const CONTEXT_RESOPNSE_SCHEME = Joi.object({
  values: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
      }).unknown(true),
    )
    .required(),
})
  .unknown(true)
  .required()

const isContextFieldResponse = createSchemeGuard<ContextGetResponse>(CONTEXT_RESOPNSE_SCHEME)

const deployJsmContextField = async (
  change: AdditionChange<InstanceElement>,
  parent: InstanceElement,
  client: JiraClient,
): Promise<SaltoElementError[]> => {
  const instance = getChangeData(change)
  const errors: SaltoElementError[] = []
  const response = await client.get({
    url: `/rest/api/3/field/${parent.value.id}/context`,
  })
  if (!isContextFieldResponse(response.data)) {
    log.debug(`Faild to fetch contexts for field ${parent.value.name}`)
    errors.push(
      createSaltoElementError({
        message: `Faild to fetch contexts for field ${parent.value.name}`,
        severity: 'Error',
        elemID: instance.elemID,
      }),
    )
    return errors
  }
  const contextNameToId = Object.fromEntries(response.data.values.map(values => [values.name, values.id]))
  const contextId = contextNameToId[instance.value.name]
  if (contextId === undefined) {
    log.debug(`Context ${instance.value.name} was not auto-generated in Jira`)
    errors.push(
      createSaltoElementError({
        message: `ContextField ${instance.value.name} was not auto-generates in Jira.`,
        severity: 'Error',
        elemID: instance.elemID,
      }),
    )
    return errors
  }
  instance.value.id = contextId
  return errors
}

const filter: FilterCreator = ({ client, config, paginator, elementsSource }) => ({
  name: 'contextDeploymentFilter',
  onFetch: async (elements: Element[]) => {
    const fieldType = findObject(elements, FIELD_TYPE_NAME)
    if (fieldType !== undefined) {
      setFieldDeploymentAnnotations(fieldType, 'contexts')
    }

    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    if (fieldContextType !== undefined) {
      await setContextDeploymentAnnotations(fieldContextType)
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME,
    )
    const errors: SaltoElementError[] = []
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const instance = getChangeData(change)
      // field contexts without fields cant be removed because they don't exist,
      // modification changes are also not allowed but will not crash.
      if (hasValidParent(instance) || !isRemovalChange(change)) {
        if (isAdditionChange(change) && hasValidParent(instance)) {
          const parent = getParent(instance)
          // checking if the field is jsm locked, and if so, we need to check that the context is auto-created.
          if (isRelatedToSpecifiedTerms(parent, [SERVICE]) && parent.value?.[IS_LOCKED] === true) {
            errors.push(...(await deployJsmContextField(change, parent, client)))
            return
          }
        }
        await deployContextChange(change, client, config.apiDefinitions, paginator, elementsSource)
      }
    })

    return {
      leftoverChanges,
      deployResult: {
        errors: [...deployResult.errors, ...errors],
        appliedChanges: deployResult.appliedChanges,
      },
    }
  },
})

export default filter
