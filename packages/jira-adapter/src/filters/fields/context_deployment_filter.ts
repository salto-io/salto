/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  isInstanceElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getParent, hasValidParent } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FilterCreator } from '../../filter'
import { deployContextChange, setContextDeploymentAnnotations } from './contexts'
import { deployChanges } from '../../deployment/standard_deployment'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
  IS_LOCKED,
  OPTIONS_ORDER_TYPE_NAME,
  SERVICE,
} from './constants'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { getContextParent, isRelatedToSpecifiedTerms } from '../../common/fields'
import JiraClient from '../../client/client'

const log = logger(module)

type ContextParams = {
  id: string
  name: string
}

type ContextGetResponse = {
  values: ContextParams[]
}
const CONTEXT_RESPONSE_SCHEME = Joi.object({
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

const isContextFieldResponse = createSchemeGuard<ContextGetResponse>(CONTEXT_RESPONSE_SCHEME)

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
        await deployContextChange({ change, client, config, paginator, elementsSource })
      }
    })

    if (config.fetch.splitFieldContextOptions) {
      // update the ids of added contexts
      deployResult.appliedChanges
        .filter(isAdditionChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .forEach(instance => {
          leftoverChanges
            .map(getChangeData)
            .filter(isInstanceElement)
            .filter(relevantInstance =>
              [FIELD_CONTEXT_OPTION_TYPE_NAME || OPTIONS_ORDER_TYPE_NAME].includes(relevantInstance.elemID.typeName),
            )
            .forEach(relevantInstance => {
              getContextParent(relevantInstance).value.id = instance.value.id
            })
        })

      // we should deploy the default values after the options deployment
      return {
        leftoverChanges: leftoverChanges.concat(deployResult.appliedChanges),
        deployResult: {
          errors: [...deployResult.errors, ...errors],
          appliedChanges: [],
        },
      }
    }

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
