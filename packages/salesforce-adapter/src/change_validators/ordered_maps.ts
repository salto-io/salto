/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator, ElemID,
  getChangeData, InstanceElement,
  isInstanceChange, isReferenceExpression, Value,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  metadataTypeToFieldToMapDef,
  findInstancesToConvert,
} from '../filters/convert_maps'

const { awu } = collections.asynciterable

const getOrderedMapErrors = (instance: InstanceElement, fieldName: string): ChangeError[] => {
  const fieldValue = instance.value[fieldName]
  if (fieldValue === undefined) {
    return []
  }
  const { values, order } = fieldValue
  if (order === undefined || values === undefined) {
    return [{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Missing field in ordered map',
      detailedMessage: `Missing order or values fields in ${instance.value.fullName} field ${fieldName}`,
    }]
  }
  const valueElemIds = Object.keys(values).map(key => instance.elemID.createNestedID(fieldName, 'values', key))
  const foundValueElemIds: ElemID[] = []
  const errors: ChangeError[] = []
  order.forEach((valueRef: Value) => {
    if (!isReferenceExpression(valueRef) || !valueElemIds.includes(valueRef.elemID)) {
      errors.push({
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Invalid reference in ordered map',
        detailedMessage: `Invalid reference in ${instance.value.fullName} field ${fieldName}.order: ${valueRef.elemID?.getFullName() ?? valueRef}. Only reference to internal value keys are allowed.`,
      })
    }
    if (foundValueElemIds.includes(valueRef.elemID)) {
      errors.push({
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Duplicate reference in ordered map',
        detailedMessage: `Duplicate reference in ${instance.value.fullName} field ${fieldName}.order: ${valueRef.elemID.getFullName()}`,
      })
    }
    foundValueElemIds.push(valueRef.elemID)
  })
  const missingElemIds = valueElemIds.filter(valueElemId => !foundValueElemIds.includes(valueElemId))
  errors.push({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Missing reference in ordered map',
    detailedMessage: `Missing reference in ${instance.value.fullName} field ${fieldName}.order: ${missingElemIds.map(elemID => elemID.name).join(', ')}`,
  })
  return errors
}

const changeValidator: ChangeValidator = async changes =>
  awu(Object.keys(metadataTypeToFieldToMapDef))
    .flatMap(async targetMetadataType => {
      const instances = await findInstancesToConvert(changes.filter(isInstanceChange).map(getChangeData), targetMetadataType)
      const fieldNames = Object.entries(metadataTypeToFieldToMapDef[targetMetadataType])
        .filter(([_fieldName, mapDef]) => mapDef.maintainOrder)
        .map(([fieldName, _mapDef]) => fieldName)

      return awu(fieldNames).flatMap(async fieldName => awu(instances).flatMap(instance => getOrderedMapErrors(instance, fieldName)).toArray()).toArray()
    })
  .toArray()

export default changeValidator