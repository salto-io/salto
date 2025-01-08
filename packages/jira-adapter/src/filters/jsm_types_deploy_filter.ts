/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { getChangeData, isInstanceChange, Change, InstanceElement } from '@salto-io/adapter-api'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { JSM_DUCKTYPE_SUPPORTED_TYPES } from '../config/api_config'
import {
  OBJECT_TYPE_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
  OBJECT_SCHMEA_REFERENCE_TYPE_TYPE,
  OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE,
  OBJECT_TYPE_ICON_TYPE,
  OBJECT_SCHEMA_GLOBAL_STATUS_TYPE,
} from '../constants'
import { getWorkspaceId } from '../workspace_id'

const { replaceInstanceTypeForDeploy } = elementUtils.ducktype
const ASSETS_SUPPORTED_TYPES = [
  OBJECT_SCHEMA_STATUS_TYPE,
  OBJECT_TYPE_TYPE,
  OBJECT_SCHMEA_REFERENCE_TYPE_TYPE,
  OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE,
  OBJECT_TYPE_ICON_TYPE,
  OBJECT_SCHEMA_GLOBAL_STATUS_TYPE,
]
const SUPPORTED_TYPES = new Set(Object.keys(JSM_DUCKTYPE_SUPPORTED_TYPES).concat(ASSETS_SUPPORTED_TYPES))

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'jsmDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [jsmTypesChanges, leftoverChanges] = _.partition(
      changes,
      change => SUPPORTED_TYPES.has(getChangeData(change).elemID.typeName) && isInstanceChange(change),
    )
    const hasAssetsChanges = jsmTypesChanges.some(change =>
      ASSETS_SUPPORTED_TYPES.includes(getChangeData(change).elemID.typeName),
    )
    const workspaceId = hasAssetsChanges ? await getWorkspaceId(client, config) : undefined
    const additionalUrlVars = workspaceId ? { workspaceId } : undefined

    const typeFixedChanges = jsmTypesChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: jsmApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]

    const deployResult = await deployChanges(typeFixedChanges, async change => {
      const instance = getChangeData(change)
      const typeDefinition = jsmApiDefinitions.types[instance.elemID.typeName]
      const deployRequest = typeDefinition.deployRequests ? typeDefinition.deployRequests[change.action] : undefined
      const fieldsToIgnore = deployRequest?.fieldsToIgnore ?? []
      await defaultDeployChange({
        change,
        client,
        apiDefinitions: jsmApiDefinitions,
        fieldsToIgnore,
        additionalUrlVars,
        allowedStatusCodesOnRemoval: [404],
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
