/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import {
  isInstanceElement,
  Element,
  isObjectType,
  isField,
  Field,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import {
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
  ZUORA_CUSTOM_SUFFIX,
  METADATA_TYPE,
  STANDARD_OBJECT,
  OBJECT_TYPE,
} from './constants'

const { awu } = collections.asynciterable

export const metadataType = async (element: Element): Promise<string | undefined> => {
  if (isInstanceElement(element)) {
    return metadataType(await element.getType())
  }
  if (isField(element)) {
    // We expect to reach to this place only with fields of CustomObject
    return CUSTOM_FIELD
  }
  return element.annotations[METADATA_TYPE]
}

export const isObjectDef = async (element: Element): Promise<boolean> =>
  isObjectType(element) && [CUSTOM_OBJECT, STANDARD_OBJECT].includes((await metadataType(element)) || 'unknown')

export const getObjectDefs = async (elements: Element[]): Promise<ObjectType[]> =>
  (await awu(elements).filter(isObjectDef).toArray()) as ObjectType[]

// This function is used to find references of standard and custom objects in workflows and tasks.
// Custom Objects referred there as 'default__<annotations.objectType>'.
// It is used in workflow_and_tasks_references filter and object_references filter.
export const getTypeNameAsReferenced = async (type: Element): Promise<string> =>
  isObjectType(type) && (await metadataType(type)) === CUSTOM_OBJECT
    ? `default__${type.annotations[OBJECT_TYPE]}`.toLowerCase()
    : type.annotations[OBJECT_TYPE].toLowerCase()

export const isCustomField = (field: Field): boolean =>
  // using the suffix as well because custom fields of standard objects don't always have origin
  field.annotations.origin === 'custom' || field.name.endsWith(ZUORA_CUSTOM_SUFFIX)

export const isInstanceOfType = (element: Element, typeNames: string[]): element is InstanceElement =>
  isInstanceElement(element) && typeNames.includes(element.refType.elemID.name)
