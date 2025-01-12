/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  Field,
  isListType,
  isObjectType,
  TypeElement,
  BuiltinTypes,
  PrimitiveType,
  isPrimitiveType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FieldToOmitType } from '../config_deprecated/transformation'
import { DATA_FIELD_ENTIRE_OBJECT } from '../definitions/system'

const { awu } = collections.asynciterable
const log = logger(module)

export type FindNestedFieldFunc = (
  type: ObjectType,
  fieldsToIgnore?: FieldToOmitType[],
  dataField?: string,
) => Promise<
  | {
      field: Field
      type: ObjectType | PrimitiveType
    }
  | undefined
>

/**
 * Field finder that always returns the full entry.
 */
export const returnFullEntry: FindNestedFieldFunc = async () => undefined

/**
 * Logic for finding the nested field that contains the response data,
 * for data returned from list endpoints where the top-level fields are not part of the resource,
 * but the nested field's name is different for each endpoint.
 * If more than one potential field is found, or if no field matches the requirements,
 * returns undefined to signal that the full entry should be used.
 */
export const findDataField: FindNestedFieldFunc = async (type, fieldsToIgnore, dataField) => {
  if (dataField === DATA_FIELD_ENTIRE_OBJECT) {
    return undefined
  }

  const shouldIgnoreField = (field: Field): boolean =>
    (fieldsToIgnore ?? []).some(
      ({ fieldName, fieldType }) =>
        fieldName === field.name && (fieldType === undefined || fieldType === field.refType.elemID.name),
    )
  const isObjectTypeDeep = async (fieldType: TypeElement): Promise<boolean> =>
    isObjectType(fieldType) || (isListType(fieldType) && isObjectTypeDeep(await fieldType.getInnerType()))

  const potentialFields =
    dataField !== undefined && type.fields[dataField] !== undefined
      ? [type.fields[dataField]]
      : await awu(Object.values(type.fields))
          .filter(async field => isObjectTypeDeep(await field.getType()))
          .filter(field => !shouldIgnoreField(field))
          .toArray()

  if (potentialFields.length > 1) {
    log.info(
      'found more than one nested field for type %s: %s, extracting full entry',
      type.elemID.name,
      potentialFields.map(f => f.name),
    )
    return undefined
  }
  if (potentialFields.length === 0) {
    log.info('could not find nested fields for type %s, extracting full entry', type.elemID.name)
    return undefined
  }
  const nestedField = potentialFields[0]
  const nestedFieldType = await nestedField.getType()
  const nestedType = isListType(nestedFieldType)
    ? await nestedFieldType.getInnerType()
    : // map type currently cannot be returned from nested fields
      nestedFieldType
  // this can happen when a dataField is specified but no entries are returned
  if (isPrimitiveType(nestedType) && nestedType.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID)) {
    return {
      field: nestedField,
      type: nestedType,
    }
  }
  if (!isObjectType(nestedType)) {
    log.info(
      'unexpected field type for type %s field %s (%s), extracting full entry',
      type.elemID.name,
      nestedField.name,
      nestedType.elemID.getFullName(),
    )
    return undefined
  }

  return {
    field: nestedField,
    type: nestedType,
  }
}
