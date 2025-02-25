/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { inspectValue, replaceTemplatesWithValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { createAdditionalParentChanges, getCustomFieldOptionsFromChanges } from '../utils'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../constants'
import { prepRef } from '../handle_template_expressions'
import { addIdsToChildrenUponAddition, deployChange, deployChanges } from '../../deployment'
import { CustomFieldOptionsFilterCreatorParams } from './creator'

const log = logger(module)

export const createDeployOptionsWithParentCreator =
  ({ filterName, parentTypeName, childTypeName, onFetch }: CustomFieldOptionsFilterCreatorParams): FilterCreator =>
  ({ oldApiDefinitions, client, definitions }) => ({
    name: filterName,
    onFetch,
    preDeploy: async changes => {
      getCustomFieldOptionsFromChanges(parentTypeName, childTypeName, changes).forEach(option => {
        option.name = option.raw_name
        // Added option won't have id until it is deployed. The API requires to pass null for new options
        option.id = option.id ?? null
      })
    },
    onDeploy: async changes => {
      getCustomFieldOptionsFromChanges(parentTypeName, childTypeName, changes).forEach(option => {
        delete option.name
        if (option.id === null) {
          log.warn('Option id is null after deploy. Option values: %s', inspectValue(option))
          delete option.id
        }
      })
    },
    deploy: async (changes: Change<InstanceElement>[]) => {
      const [relevantChanges, leftoverChanges] = _.partition(changes, change =>
        [parentTypeName, childTypeName].includes(getChangeData(change).elemID.typeName),
      )
      const [parentChanges, childrenChanges] = _.partition(
        relevantChanges,
        change => getChangeData(change).elemID.typeName === parentTypeName,
      )
      const additionalParentChanges =
        parentChanges.length === 0 && childrenChanges.length > 0
          ? await createAdditionalParentChanges(childrenChanges)
          : []
      if (additionalParentChanges === undefined) {
        return {
          deployResult: {
            appliedChanges: [],
            errors: childrenChanges.map(getChangeData).map(e => {
              const message = `Failed to update ${e.elemID.getFullName()} since it has no valid parent`
              return {
                message,
                detailedMessage: message,
                severity: 'Error',
                elemID: e.elemID,
              }
            }),
          },
          leftoverChanges,
        }
      }

      // Because this is a fake change, it did not pass preDeploy and the templateExpressions were not converted to values
      additionalParentChanges.forEach(change => {
        const customFieldOptions = getChangeData(change).value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
        if (_.isArray(customFieldOptions)) {
          // These are fake changes which do not show in appliedChanges
          // so we don't need to worry about reverting to templates later on
          replaceTemplatesWithValues({ values: customFieldOptions, fieldName: 'raw_name' }, {}, prepRef)
        }
      })

      const deployResult = await deployChanges([...parentChanges, ...additionalParentChanges], async change => {
        const response = await deployChange({
          change,
          client,
          apiDefinitions: oldApiDefinitions,
          definitions,
        })
        return addIdsToChildrenUponAddition({
          response,
          parentChange: change,
          childrenChanges,
          apiDefinitions: oldApiDefinitions,
          definitions,
          childFieldName: CUSTOM_FIELD_OPTIONS_FIELD_NAME,
          childUniqueFieldName: 'value',
        })
      })

      const additionalParentIds = new Set(additionalParentChanges.map(getChangeData).map(e => e.elemID.getFullName()))
      return {
        deployResult: {
          errors: deployResult.errors,
          appliedChanges: deployResult.appliedChanges.filter(
            change => !additionalParentIds.has(getChangeData(change).elemID.getFullName()),
          ),
        },
        leftoverChanges,
      }
    },
  })
