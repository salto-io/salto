/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  InstanceElement,
  ReferenceExpression,
  SaltoElementError,
  SeverityLevel,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { inspectValue } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from './constants'
import { setContextOptionsSplitted } from './context_options_splitted'
import { getContextAndFieldIds } from '../../common/fields'
import { getAllDefaultValuePaths, updateDefaultValueIds } from './default_values'
import { AddOrModifyInstanceChange } from '../../common/general'

const log = logger(module)

const preventDefaultValuesDeployment = (
  leftoverChanges: Change[],
  contextId: string,
  errors: SaltoElementError[],
): void => {
  const getContextChange = (searchChanges: Change[], id: string): AddOrModifyInstanceChange | undefined =>
    searchChanges
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .find((change: Change<InstanceElement>) => getChangeData(change).value.id === id)

  const findOptionWithoutId = (contextChange: Change<InstanceElement>): ReferenceExpression | undefined => {
    const defaultValues = getChangeData(contextChange).value.defaultValue
    return getAllDefaultValuePaths(defaultValues)
      .map(path => _.get(defaultValues, path))
      .filter(isReferenceExpression)
      .find(
        value => value.value.id == null, // undefined or null
      )
  }

  const contextChange = getContextChange(leftoverChanges, contextId)
  if (contextChange === undefined) return
  const optionReferenceWithoutId = findOptionWithoutId(contextChange)
  if (optionReferenceWithoutId !== undefined) {
    errors.push({
      message: 'Could not deploy default value',
      detailedMessage: `The context field will be deployed without the default value, as the default value depends on a field context option ${optionReferenceWithoutId.elemID.getFullName()} that could not be deployed.`,
      severity: 'Error',
      elemID: getChangeData(contextChange).elemID,
    })
    _.remove(leftoverChanges, change => getChangeData(change).elemID.isEqual(getChangeData(contextChange).elemID))
  }
}

const allOptionsWithSameContextAndField = (
  relevantChanges: Change<InstanceElement>[],
  contextId: string,
  fieldId: string,
): boolean =>
  relevantChanges
    .map(getContextAndFieldIds)
    .find(
      ({ contextId: currContextId, fieldId: currFieldId }) => currContextId !== contextId || currFieldId !== fieldId,
    ) === undefined

const filter: FilterCreator = ({ config, client, paginator, elementsSource }) => ({
  name: 'fieldContextOptionsDeploymentFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]
    if (!config.fetch.splitFieldContextOptions || relevantChanges.length === 0 || elementsSource === undefined) {
      return { leftoverChanges: changes, deployResult: { errors: [], appliedChanges: [] } }
    }
    const errors: SaltoElementError[] = []
    let appliedChanges = relevantChanges

    // Validate that all changes are of the same context and field
    // It should be impossible to have changes of different contexts and fields in the same deploy, if there are such changes, it is a bug in the grouping logic
    const { contextId, fieldId } = getContextAndFieldIds(relevantChanges[0])
    if (!allOptionsWithSameContextAndField(relevantChanges, contextId, fieldId)) {
      log.error('All field context options must be of the same context and field')
      const message = 'Inner problem occurred during deployment of custom field context options, please contact support'
      return {
        leftoverChanges,
        deployResult: {
          errors: relevantChanges.map(change => ({
            message,
            detailedMessage: message,
            severity: 'Error',
            elemID: getChangeData(change).elemID,
          })),
          appliedChanges: [],
        },
      }
    }

    const [addChanges, modifyOrRemoveChanges] = _.partition(relevantChanges, change => isAdditionChange(change))
    const [modifyChanges, removeChanges] = _.partition(modifyOrRemoveChanges, change => isModificationChange(change))
    try {
      await setContextOptionsSplitted({
        contextId,
        fieldId,
        added: addChanges.map(getChangeData),
        modified: modifyChanges.map(getChangeData),
        removed: removeChanges.map(getChangeData),
        client,
        elementsSource,
        paginator,
      })
      updateDefaultValueIds({
        contextInstances: leftoverChanges
          .filter(isAdditionOrModificationChange)
          .map(getChangeData)
          .filter(isInstanceElement)
          .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME),
        addedOptionInstances: addChanges.map(getChangeData),
      })
    } catch (err) {
      if (
        addChanges.length === 0 &&
        modifyChanges.length === 0 &&
        err instanceof clientUtils.HTTPError &&
        err.response.status === 404
      ) {
        // We delete the context before the options, so if the context is already deleted, we can ignore the error
        log.debug('All field context options were already deleted')
      } else {
        log.error('An error occurred during deployment of custom field context options: %o', err)
        const message = inspectValue(err)
        errors.push(
          ...relevantChanges.map(change => ({
            message,
            detailedMessage: message,
            severity: 'Error' as SeverityLevel,
            elemID: getChangeData(change).elemID,
          })),
        )
        appliedChanges = []
        preventDefaultValuesDeployment(leftoverChanges, contextId, errors)
      }
    }

    return {
      leftoverChanges,
      deployResult: {
        errors,
        appliedChanges,
      },
    }
  },
})
export default filter
