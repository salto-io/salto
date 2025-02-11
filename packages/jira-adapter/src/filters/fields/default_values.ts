/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Change,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isEqualValues,
  isObjectType,
  isRemovalChange,
  isRemovalOrModificationChange,
  ObjectType,
  ReadOnlyElementsSource,
  Value,
} from '@salto-io/adapter-api'
import { client as clientUtils, resolveChangeElement, resolveValues } from '@salto-io/adapter-components'
import {
  applyFunctionToChangeData,
  getParents,
  isResolvedReferenceExpression,
  resolvePath,
} from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getLookUpName } from '../../reference_mapping'
import { addAnnotationRecursively, setFieldDeploymentAnnotations } from '../../utils'
import { JiraConfig } from '../../config/config'

const ApplyOnDefaultValues = (defaultValue: Value, applyFunc: (value: Value, path: string[]) => void): void => {
  const valueLocations = [['optionId'], ['cascadingOptionId']]
  if (Array.isArray(defaultValue.optionIds)) {
    valueLocations.push(..._.range(0, defaultValue.optionIds.length).map(index => ['optionIds', `${index}`]))
  }
  valueLocations.forEach(pathArray => {
    applyFunc(defaultValue, pathArray)
  })
}

// called only for splitted options
export const updateDefaultValueIds = ({
  contextInstances,
  addedOptionInstances,
}: {
  contextInstances: InstanceElement[]
  addedOptionInstances: InstanceElement[]
}): void => {
  const relevantContexts = contextInstances.filter(contextInstance => contextInstance.value.defaultValue !== undefined)
  if (relevantContexts.length === 0) {
    return
  }
  const optionsIdByElemId: Record<string, string> = Object.fromEntries(
    addedOptionInstances.map(option => [option.elemID.getFullName(), option.value.id]),
  )

  relevantContexts.forEach(contextInstance => {
    ApplyOnDefaultValues(contextInstance.value.defaultValue, (value, path) => {
      if (
        isResolvedReferenceExpression(_.get(value, path)) &&
        optionsIdByElemId[_.get(value, path).elemID.getFullName()] !== undefined
      ) {
        _.get(value, path).value.value.id = optionsIdByElemId[_.get(value, path).elemID.getFullName()]
      }
    })
  })
}

const resolveDefaultOption = (
  contextChange: Change<InstanceElement>,
  config: JiraConfig,
): Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData<Change<InstanceElement>>(contextChange, instance => {
    const clonedInstance = instance.clone()
    ;['optionId', 'cascadingOptionId']
      .filter(fieldName => isResolvedReferenceExpression(clonedInstance.value.defaultValue?.[fieldName]))
      .forEach(fieldName => {
        // We resolve this values like this and not with resolveChangeElement
        // is because if we just created these options, the options under instance.value will
        // include the new option ids while the copied options under the references
        // resValues won't
        clonedInstance.value.defaultValue[fieldName] = config.fetch.splitFieldContextOptions
          ? clonedInstance.value.defaultValue[fieldName].value.value.id
          : resolvePath(clonedInstance, clonedInstance.value.defaultValue[fieldName].elemID).id
      })
    const optionIds = clonedInstance.value.defaultValue?.optionIds
    if (Array.isArray(optionIds)) {
      clonedInstance.value.defaultValue.optionIds = optionIds
        .filter(isResolvedReferenceExpression)
        .map(ref =>
          config.fetch.splitFieldContextOptions ? ref.value.value.id : resolvePath(clonedInstance, ref.elemID).id,
        )
        .filter(values.isDefined)
    }
    return clonedInstance
  })

export const updateDefaultValues = async (
  contextChange: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface,
  config: JiraConfig,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(
    await resolveDefaultOption(contextChange, config),
    getLookUpName,
    resolveValues,
    elementsSource,
  )

  const beforeDefault = isRemovalOrModificationChange(resolvedChange)
    ? resolvedChange.data.before.value.defaultValue
    : undefined

  const afterDefault = isAdditionOrModificationChange(resolvedChange)
    ? resolvedChange.data.after.value.defaultValue
    : undefined

  if (isRemovalChange(contextChange) || isEqualValues(beforeDefault, afterDefault)) {
    return
  }

  const defaultValueToUpdate =
    afterDefault ??
    _.mapValues(
      beforeDefault,
      // The way to delete a default value is to set its values to null
      (value: Value, key: string) => (['contextId', 'type'].includes(key) ? value : null),
    )

  const contextInstance = getChangeData(resolvedChange)
  const parentId = getParents(contextInstance)[0].id

  await client.put({
    url: `/rest/api/3/field/${parentId}/context/defaultValue`,
    data: {
      defaultValues: [
        {
          ...defaultValueToUpdate,
          contextId: contextInstance.value.id,
        },
      ],
    },
  })
}

export const setDefaultValueTypeDeploymentAnnotations = async (fieldContextType: ObjectType): Promise<void> => {
  const defaultValueType = await fieldContextType.fields.defaultValue?.getType()
  if (!isObjectType(defaultValueType)) {
    throw new Error(
      `type ${defaultValueType.elemID.getFullName()} of ${fieldContextType.fields.defaultValue?.elemID.getFullName()} is not an object type`,
    )
  }

  setFieldDeploymentAnnotations(fieldContextType, 'defaultValue')
  await addAnnotationRecursively(defaultValueType, CORE_ANNOTATIONS.CREATABLE)
  await addAnnotationRecursively(defaultValueType, CORE_ANNOTATIONS.UPDATABLE)
}
