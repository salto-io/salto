/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isRemovalChange,
  toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { deployContextChange, getContexts, getContextType } from './contexts'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FIELD_TYPE_NAME } from './constants'
import { JiraConfig } from '../../config/config'

const log = logger(module)
const { awu } = collections.asynciterable

const REDIRECT_PATH_PREFIX = '/rest/api/3/task/'

const deployField = async (change: Change<InstanceElement>, client: JiraClient, config: JiraConfig): Promise<void> => {
  try {
    await defaultDeployChange({
      change,
      client,
      apiDefinitions: config.apiDefinitions,
      fieldsToIgnore: ['contexts'],
    })
  } catch (err) {
    if (
      isRemovalChange(change) &&
      err instanceof clientUtils.HTTPError &&
      err.response.requestPath?.startsWith(REDIRECT_PATH_PREFIX)
    ) {
      log.warn(
        `Got an error when trying to delete a field, probably becuase a redirect happened. Ignoring error. requestPath: ${err.response.requestPath}`,
      )
    } else {
      throw err
    }
  }

  if (isAdditionChange(change)) {
    const contextType = await getContextType(await getChangeData(change).getType())
    // When creating a field, it is created with a default context,
    // in addition to what is in the NaCl so we need to delete it
    const removalContextsChanges = isAdditionChange(change)
      ? (await getContexts(change, contextType, client)).map(instance => toChange({ before: instance }))
      : []

    await awu(removalContextsChanges).forEach(contextChange =>
      deployContextChange({ change: contextChange, client, config }),
    )
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'fieldDeploymentFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), change =>
      deployField(change, client, config),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
