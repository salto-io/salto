/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { createSaltoElementError, inspectValue } from '@salto-io/adapter-utils'
import { retry } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import ZendeskClient from '../client/client'
import { APP_INSTALLATION_TYPE_NAME, APP_OWNED_TYPE_NAME } from '../constants'

const { withRetry } = retry
const { intervals } = retry.retryStrategies
const log = logger(module)

const MAX_RETRIES = 60
const INTERVAL_TIME = 2000

type JobStatus = {
  status: string
  message?: string
}

const EXPECTED_APP_SCHEMA = Joi.object({
  status: Joi.string().required(),
  message: Joi.string().optional().allow(''),
})
  .unknown(true)
  .required()

const isJobStatus = (value: unknown): value is JobStatus => {
  const { error } = EXPECTED_APP_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the job status: ${error.message}, ${inspectValue(value)}`)
    return false
  }
  return true
}

const checkIfJobIsDone = async (client: ZendeskClient, jobId: string, change: Change): Promise<boolean> => {
  const res = (await client.get({ url: `/api/v2/apps/job_statuses/${jobId}` })).data
  if (!isJobStatus(res)) {
    const message = `Got an invalid response for job status. Job ID: ${jobId}`
    throw createSaltoElementError({
      // caught by deployChanges
      message,
      detailedMessage: message,
      severity: 'Error',
      elemID: getChangeData(change).elemID,
    })
  }
  if (['failed', 'killed'].includes(res.status)) {
    const message = `Job status is failed. Job ID: ${jobId}. Error: ${res.message}`
    throw createSaltoElementError({
      // caught by deployChanges
      message,
      detailedMessage: message,
      severity: 'Error',
      elemID: getChangeData(change).elemID,
    })
  }
  return res.status === 'completed'
}

const waitTillJobIsDone = async (client: ZendeskClient, jobId: string, change: Change): Promise<void> => {
  await withRetry(() => checkIfJobIsDone(client, jobId, change), {
    strategy: intervals({
      maxRetries: MAX_RETRIES,
      interval: INTERVAL_TIME,
    }),
  })
}

const connectAppOwnedToInstallation = (instances: InstanceElement[]): void => {
  const appOwnedById = _.keyBy<InstanceElement>(
    instances.filter(e => e.elemID.typeName === APP_OWNED_TYPE_NAME).filter(e => e.value.id !== undefined),
    e => e.value.id,
  )

  instances
    .filter(e => e.elemID.typeName === APP_INSTALLATION_TYPE_NAME)
    .forEach(appInstallation => {
      const appOwnedElement = appOwnedById[appInstallation.value.app_id]
      if (appOwnedElement) {
        appInstallation.value.app_id = new ReferenceExpression(appOwnedElement.elemID, appOwnedElement)
      }
    })
}

/**
 * Edits app_installation value on fetch, Deploys app_installation on deploy
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'appInstallationsFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APP_INSTALLATION_TYPE_NAME)
      .forEach(e => {
        delete e.value.settings_objects
      })

    connectAppOwnedToInstallation(elements.filter(isInstanceElement))
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isAdditionOrModificationChange(change) && getChangeData(change).elemID.typeName === APP_INSTALLATION_TYPE_NAME,
    )
    const deployResult = await deployChanges(relevantChanges, async change => {
      const response = await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      if (isAdditionChange(change)) {
        if (response == null || _.isArray(response) || !_.isString(response.pending_job_id)) {
          const message = 'Got an invalid response when tried to install app'
          throw createSaltoElementError({
            // caught by deployChanges
            message,
            detailedMessage: message,
            severity: 'Error',
            elemID: getChangeData(change).elemID,
          })
        }
        await waitTillJobIsDone(client, response.pending_job_id, change)
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
