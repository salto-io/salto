/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { hasValidParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { deployContextChange, setContextDeploymentAnnotations } from './contexts'
import { deployChanges } from '../../deployment/standard_deployment'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from './constants'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { getContextParent } from '../../common/fields'

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
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      // field contexts without fields cant be removed because they don't exist,
      // modification changes are also not allowed but will not crash.
      if (hasValidParent(getChangeData(change)) || !isRemovalChange(change)) {
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
              [FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME].includes(relevantInstance.elemID.typeName),
            )
            .forEach(relevantInstance => {
              getContextParent(relevantInstance).value.id = instance.value.id
            })
        })

      // we should deploy the default values after the options deployment
      return {
        leftoverChanges: leftoverChanges.concat(deployResult.appliedChanges),
        deployResult: {
          errors: deployResult.errors,
          appliedChanges: [],
        },
      }
    }

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
