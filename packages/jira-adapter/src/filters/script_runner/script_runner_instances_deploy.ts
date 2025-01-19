/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements as elementUtils } from '@salto-io/adapter-components'
import { Change, InstanceElement, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'
import { scriptRunnerAuditSetter } from './script_runner_filter'

const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

// This filter deploys script runner instances
const filter: FilterCreator = ({ scriptRunnerClient, config }) => ({
  name: 'scripRunnerInstancesDeployFilter',
  deploy: async changes => {
    const { scriptRunnerApiDefinitions } = config
    if (!config.fetch.enableScriptRunnerAddon || scriptRunnerApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        scriptRunnerApiDefinitions.types[getChangeData(change).elemID.typeName] !== undefined,
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: { errors: [], appliedChanges: [] },
      }
    }
    const typeFixedChanges = relevantChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: scriptRunnerApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]
    const deployResult = await deployChanges(typeFixedChanges.filter(isInstanceChange), async change => {
      await defaultDeployChange({
        change,
        client: scriptRunnerClient,
        apiDefinitions: scriptRunnerApiDefinitions,
        hiddenFieldsSetter: scriptRunnerAuditSetter, // the time stamps might differ between the request and the response
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filter
