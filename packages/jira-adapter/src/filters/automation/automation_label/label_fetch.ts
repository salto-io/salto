/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemIdGetter, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { createSchemeGuard, ERROR_MESSAGES, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { JIRA, AUTOMATION_LABEL_TYPE, fetchFailedWarnings } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { createAutomationLabelType } from './types'
import { LABELS_POST_RESPONSE_SCHEME, LabelsResponse } from './label_deployment'

const log = logger(module)

const LABELS_GET_RESPONSE_SCHEME = Joi.array().items(LABELS_POST_RESPONSE_SCHEME)

const isLabelsGetResponse = createSchemeGuard<LabelsResponse[]>(
  LABELS_GET_RESPONSE_SCHEME,
  'Failed to get automation labels, received invalid response',
)

const createInstance = (values: Values, type: ObjectType, getElemIdFunc?: ElemIdGetter): InstanceElement => {
  const serviceIds = elementUtils.createServiceIds({ entry: values, serviceIDFields: ['id'], typeID: type.elemID })

  const defaultName = naclCase(values.name)

  const instanceName = getElemIdFunc && serviceIds ? getElemIdFunc(JIRA, serviceIds, defaultName).name : defaultName

  return new InstanceElement(instanceName, type, values, [
    JIRA,
    elementUtils.RECORDS_PATH,
    AUTOMATION_LABEL_TYPE,
    pathNaclCase(instanceName),
  ])
}

/**
 * Fetching automation labels from Jira using internal API endpoint.
 * We first use `/resources` endpoint to get the cloud id of the account.
 * Using the cloud id, we create the url to query the automation labels with
 */
const filter: FilterCreator = ({ client, getElemIdFunc, config, fetchQuery }) => ({
  name: 'automationLabelFetchFilter',
  onFetch: async elements => {
    if (!fetchQuery.isTypeMatch(AUTOMATION_LABEL_TYPE)) {
      return undefined
    }

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping label automation fetch filter because private API is not enabled')
      return undefined
    }

    try {
      // get labels
      const url = client.isDataCenter
        ? '/rest/cb-automation/latest/rule-label'
        : `/gateway/api/automation/internal-api/jira/${await client.getCloudId()}/pro/rest/GLOBAL/rule-labels`
      const response = await client.get({ url })
      if (!isLabelsGetResponse(response.data)) {
        log.error('Failed to get automation labels, received invalid response')
        return {
          errors: [
            {
              message: ERROR_MESSAGES.OTHER_ISSUES,
              detailedMessage: 'Unable to fetch automation labels due to invalid response',
              severity: 'Warning',
            },
          ],
        }
      }
      const automationLabels = response.data
      const automationLabelType = createAutomationLabelType()
      automationLabels.forEach(automationLabel =>
        elements.push(createInstance(automationLabel, automationLabelType, getElemIdFunc)),
      )
      elements.push(automationLabelType)
      return undefined
    } catch (e) {
      if (
        e instanceof clientUtils.HTTPError &&
        e.response !== undefined &&
        (e.response.status === 403 || e.response.status === 405)
      ) {
        log.error(
          `Received a ${e.response.status} error when fetching automation labels. Please make sure you have the "Automation" permission enabled in Jira.`,
        )
        return {
          errors: [
            {
              message: ERROR_MESSAGES.OTHER_ISSUES,
              detailedMessage: fetchFailedWarnings(AUTOMATION_LABEL_TYPE),
              severity: 'Warning',
            },
          ],
        }
      }
      throw e
    }
  },
})

export default filter
