/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeError,
  ChangeValidator,
  Element,
  ElemID,
  getChangeData,
  isFieldChange,
  isInstanceChange,
  isReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  metadataTypeToFieldToMapDef,
  annotationDefsByType,
  findInstancesToConvert,
  getElementValueOrAnnotations,
  getFieldChangesOfType,
} from '../filters/convert_maps'

const { awu } = collections.asynciterable

export const getOrderedMapErrors = (element: Element, fieldName: string): ChangeError[] => {
  const elementValues = getElementValueOrAnnotations(element)
  const fieldValue = elementValues[fieldName]
  if (fieldValue === undefined) {
    return []
  }
  const { values, order } = fieldValue
  if (order === undefined || values === undefined) {
    return [
      {
        elemID: element.elemID,
        severity: 'Error',
        message: 'Missing field in ordered map',
        detailedMessage: `Missing order or values fields in field ${fieldName}`,
      },
    ]
  }
  const valueElemIds: ElemID[] = Object.keys(values).map(key => element.elemID.createNestedID(fieldName, 'values', key))
  const foundValueElemIds: ElemID[] = []
  const errors: ChangeError[] = []
  order.forEach((valueRef: Value) => {
    if (
      !isReferenceExpression(valueRef) ||
      !valueElemIds.map(elemID => elemID.getFullName()).includes(valueRef.elemID.getFullName())
    ) {
      errors.push({
        elemID: element.elemID,
        severity: 'Error',
        message: 'Invalid reference in ordered map',
        detailedMessage: `Invalid reference in field ${fieldName}.order: ${valueRef.elemID?.getFullName() ?? valueRef}. Only reference to internal value keys are allowed.`,
      })
      return
    }
    if (foundValueElemIds.map(elemID => elemID.getFullName()).includes(valueRef.elemID.getFullName())) {
      errors.push({
        elemID: element.elemID,
        severity: 'Error',
        message: 'Duplicate reference in ordered map',
        detailedMessage: `Duplicate reference in field ${fieldName}.order: ${valueRef.elemID.name}`,
      })
    }
    foundValueElemIds.push(valueRef.elemID)
  })
  const missingElemIds = valueElemIds.filter(
    valueElemId => !foundValueElemIds.map(elemID => elemID.getFullName()).includes(valueElemId.getFullName()),
  )
  if (!_.isEmpty(missingElemIds)) {
    errors.push({
      elemID: element.elemID,
      severity: 'Error',
      message: 'Missing reference in ordered map',
      detailedMessage: `Missing reference in field ${fieldName}.order: ${missingElemIds.map(elemID => elemID.name).join(', ')}`,
    })
  }
  return errors
}

const changeValidator: ChangeValidator = async changes => {
  const instanceErrors: ChangeError[] = await awu(Object.keys(metadataTypeToFieldToMapDef))
    .flatMap(async targetMetadataType => {
      const instances = await findInstancesToConvert(
        changes.filter(isInstanceChange).map(getChangeData),
        targetMetadataType,
      )
      if (_.isEmpty(instances)) {
        return []
      }
      const fieldNames = Object.entries(metadataTypeToFieldToMapDef[targetMetadataType])
        .filter(([_fieldName, mapDef]) => mapDef.maintainOrder)
        .map(([fieldName, _mapDef]) => fieldName)

      return fieldNames.flatMap(fieldName => instances.flatMap(instance => getOrderedMapErrors(instance, fieldName)))
    })
    .toArray()

  const objectTypeErrors: ChangeError[] = await awu(Object.keys(annotationDefsByType))
    .flatMap(async fieldType => {
      const fieldNames = Object.entries(annotationDefsByType[fieldType])
        .filter(([_fieldName, annotationDef]) => annotationDef.maintainOrder)
        .map(([fieldName, _mapDef]) => fieldName)

      const fieldChanges = await getFieldChangesOfType(changes, fieldType)
      const types = awu(fieldChanges)
        .filter(isFieldChange)
        .map(async change => {
          await getChangeData(change).getType()
        })
      if (types === undefined) {
        return []
      }
      return fieldChanges
        .flatMap(getChangeData)
        .flatMap(field => fieldNames.flatMap(fieldName => getOrderedMapErrors(field, fieldName)))
    })
    .toArray()
  return instanceErrors.concat(objectTypeErrors)
}

export default changeValidator
