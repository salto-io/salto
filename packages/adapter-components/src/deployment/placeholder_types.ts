/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import {
  BuiltinTypes,
  Change,
  Field,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isReferenceExpression,
  TypeReference,
} from '@salto-io/adapter-api'
import { ElementAndResourceDefFinder } from '../definitions/system/fetch/types'
import { generateType, overrideFieldTypes } from '../fetch/element'
import { FetchApiDefinitionsOptions } from '../definitions/system/fetch'

/**
 * Changes instance type to be suitable for the deploy (generated from the latest instance))
 */
export const overrideInstanceTypeForDeploy = <Options extends FetchApiDefinitionsOptions>({
  instance,
  defQuery,
}: {
  instance: InstanceElement
  defQuery: ElementAndResourceDefFinder<Options>
}): InstanceElement => {
  const { typeName } = instance.elemID
  const clonedInstance = instance.clone()
  const generatedType = generateType({
    adapterName: clonedInstance.elemID.adapter,
    entries: [clonedInstance.value],
    typeName,
    defQuery,
    isUnknownEntry: isReferenceExpression,
    definedTypes: {},
  })
  const definedTypes = _.keyBy([generatedType.type, ...generatedType.nestedTypes], t => t.elemID.typeName)
  overrideFieldTypes({ definedTypes, defQuery })
  // make sure all service id fields are there even on additions (which might not have values for them)
  defQuery.query(typeName)?.resource?.serviceIDFields?.forEach(fieldName => {
    if (generatedType.type.fields[fieldName] === undefined) {
      generatedType.type.fields[fieldName] =
        instance.getTypeSync().fields[fieldName] ?? new Field(generatedType.type, fieldName, BuiltinTypes.SERVICE_ID)
    }
  })

  clonedInstance.refType = new TypeReference(generatedType.type.elemID, generatedType.type)
  return clonedInstance
}

/**
 * Restores instance type to have the original type (and not the fixed one for the deploy)
 */
export const restoreInstanceTypeFromChange = ({
  appliedChanges,
  originalInstanceChanges,
}: {
  appliedChanges: Change[]
  originalInstanceChanges: Change<InstanceElement>[]
}): Change[] => {
  const elemIDToOriginalType = Object.fromEntries(
    originalInstanceChanges.map(getChangeData).map(inst => [inst.elemID.getFullName(), inst.refType]),
  )
  const [instanceChanges, nonInstanceChanges] = _.partition(appliedChanges, isInstanceChange)
  const appliedInstanceChanges = instanceChanges.map(change => ({
    action: change.action,
    data: _.mapValues(change.data, (instance: InstanceElement) => {
      instance.refType = elemIDToOriginalType[instance.elemID.getFullName()] ?? instance.refType
      return instance
    }),
  })) as Change<InstanceElement>[]
  return [...nonInstanceChanges, ...appliedInstanceChanges]
}
