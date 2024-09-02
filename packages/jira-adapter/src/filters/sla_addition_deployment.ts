/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  AdditionChange,
  Change,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  toChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard, getParent, hasValidParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { elements as elementUtils } from '@salto-io/adapter-components'
import Joi from 'joi'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { SLA_TYPE_NAME } from '../constants'
import JiraClient from '../client/client'

const log = logger(module)
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

type SlaParams = {
  id: number
  name: string
}

type SlaGetResponse = {
  timeMetrics: SlaParams[]
}
const SLA_RESPONSE_SCHEME = Joi.object({
  timeMetrics: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().required(),
        name: Joi.string().required(),
      }).unknown(true),
    )
    .required(),
})
  .unknown(true)
  .required()

const isSlaResponse = createSchemeGuard<SlaGetResponse>(SLA_RESPONSE_SCHEME, 'Received invalid SLA response')

const getExistingSlaNamesAndIds = async (parent: InstanceElement, client: JiraClient): Promise<SlaParams[]> => {
  try {
    const response = await client.get({
      url: `/rest/servicedesk/1/servicedesk/agent/${parent.value.key}/sla/metrics`,
    })
    if (!isSlaResponse(response.data)) {
      return []
    }
    const existingSlas = response.data.timeMetrics.map(({ name, id }) => ({ name, id }))
    return existingSlas
  } catch (e) {
    log.error(`failed to get existing Slas due to an error ${e}`)
    return []
  }
}

const createSlaModificationChange = (
  change: AdditionChange<InstanceElement>,
  serviceId: number,
): ModificationChange<InstanceElement> => {
  change.data.after.value.id = serviceId
  const emptySlaInstance = change.data.after.clone()
  emptySlaInstance.value = {}
  return toChange({ before: emptySlaInstance, after: change.data.after }) as ModificationChange<InstanceElement>
}

/*
 * This filter responsible for deploying slas with default names.
 * all other sla, will be deployed through the standard JSM deployment.
 */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'slaAdditionFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [slaAdditionChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isAdditionChange(change) && isInstanceChange(change) && getChangeData(change).elemID.typeName === SLA_TYPE_NAME,
    )

    if (slaAdditionChanges.length === 0) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const projectsWithSlaAdditions = new Set(
      slaAdditionChanges
        .map(change => getChangeData(change))
        .filter(instance => hasValidParent(instance))
        .map(instance => getParent(instance)),
    )

    const projectToServiceSlas: Record<string, SlaParams[]> = Object.fromEntries(
      await Promise.all(
        Array.from(projectsWithSlaAdditions).map(async project => [
          project.elemID.getFullName(),
          await getExistingSlaNamesAndIds(project, client),
        ]),
      ),
    )
    const typeFixedChanges = slaAdditionChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: jsmApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]

    const deployResult = await deployChanges(
      typeFixedChanges.filter(isInstanceChange).filter(isAdditionChange),
      async change => {
        const serviceSLA = _.keyBy(
          projectToServiceSlas[getParent(getChangeData(change)).elemID.getFullName()] ?? [],
          'name',
        )[change.data.after.value.name]
        const updatedChange =
          serviceSLA === undefined || serviceSLA.id === undefined
            ? change
            : createSlaModificationChange(change, serviceSLA.id)
        await defaultDeployChange({
          change: updatedChange,
          client,
          apiDefinitions: jsmApiDefinitions,
        })
      },
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
