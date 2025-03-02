/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, getChangeData, InstanceElement, isRemovalChange, Values } from '@salto-io/adapter-api'
import { createSaltoElementError } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { applyforInstanceChangesOfType } from './utils'

const WORKSPACE_TYPE_NAME = 'workspace'

/**
 * Deploys workspaces
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'workspaceFilter',
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(changes, [WORKSPACE_TYPE_NAME], (instance: InstanceElement) => {
      instance.value = {
        ...instance.value,
        macros: (instance.value.selected_macros ?? [])
          .filter(_.isPlainObject)
          .map((e: Values) => e.id)
          .filter(values.isDefined),
      }
      return instance
    })
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(changes, [WORKSPACE_TYPE_NAME], (instance: InstanceElement) => {
      instance.value = _.omit(instance.value, ['macros'])
      return instance
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [workspaceChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === WORKSPACE_TYPE_NAME && !isRemovalChange(change),
    )
    const deployResult = await deployChanges(workspaceChanges, async change => {
      const response = await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: ['selected_macros'],
      })
      // It's possible for the deployment to return with status 200 and still have errors.
      if (response !== undefined && !_.isArray(response) && response.errors !== undefined) {
        let errorMsg = 'Something went wrong'
        if (Array.isArray(response.errors) && response.errors.length > 0) {
          errorMsg = String(response.errors[0])
        } else if (typeof response.errors === 'string') {
          errorMsg = response.errors
        }
        throw createSaltoElementError({
          // caught by deployChanges
          message: errorMsg,
          detailedMessage: errorMsg,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        })
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
