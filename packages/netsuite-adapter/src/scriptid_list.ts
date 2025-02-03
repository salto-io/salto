/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  InstanceElement,
  ReadOnlyElementsSource,
  isInstanceElement,
  createRefToElmWithValue,
  ListType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { NETSUITE } from './constants'
import { ObjectID } from './config/types'

const log = logger(module)

const OBJECT_ID_TYPE_NAME = 'objectid'
export const OBJECT_ID_LIST_TYPE_NAME = 'objectid_list'
export const OBJECT_ID_LIST_FIELD_NAME = 'objectid_list'

const OBJECT_ID_TYPE_ID = new ElemID(NETSUITE, OBJECT_ID_TYPE_NAME)
const OBJECT_ID_LIST_TYPE_ID = new ElemID(NETSUITE, OBJECT_ID_LIST_TYPE_NAME)
const OBJECT_ID_LIST_INSTANCE_ID = new ElemID(NETSUITE, OBJECT_ID_LIST_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

const objectIdType = createMatchingObjectType<ObjectID>({
  elemID: OBJECT_ID_TYPE_ID,
  isSettings: true,
  fields: {
    instanceId: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
    type: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
    suiteAppId: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

const objectIdListObjectType = new ObjectType({
  elemID: OBJECT_ID_LIST_TYPE_ID,
  isSettings: true,
  fields: {
    [OBJECT_ID_LIST_FIELD_NAME]: { refType: new ListType(objectIdType) },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

export const createObjectIdListElements = (instancesIds: ObjectID[]): [ObjectType, ObjectType, InstanceElement] => {
  log.debug('Creating object id list elements')
  const instance = new InstanceElement(
    OBJECT_ID_LIST_INSTANCE_ID.name,
    objectIdListObjectType,
    { [OBJECT_ID_LIST_FIELD_NAME]: instancesIds },
    undefined,
    {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  )

  return [objectIdType, objectIdListObjectType, instance]
}

const getExistingObjectIdListElements = async (
  instancesIds: ObjectID[],
  elementsSource: ReadOnlyElementsSource,
): Promise<[ObjectType, ObjectType, InstanceElement]> => {
  const instance = await elementsSource.get(OBJECT_ID_LIST_INSTANCE_ID)
  if (!isInstanceElement(instance)) {
    log.warn('object id list instance not found in elements source')
    return createObjectIdListElements(instancesIds)
  }
  // Resolve the type of the instance cause it's used inside the adapter that assumes resolved types
  instance.refType = createRefToElmWithValue(objectIdListObjectType)

  return [objectIdType, objectIdListObjectType, instance]
}

export const getOrCreateObjectIdListElements = async (
  instancesIds: ObjectID[],
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<[ObjectType, ObjectType, InstanceElement]> =>
  isPartial ? getExistingObjectIdListElements(instancesIds, elementsSource) : createObjectIdListElements(instancesIds)

export const getObjectIdList = async (elementsSource: ReadOnlyElementsSource): Promise<ObjectID[]> => {
  const objectIdListElement = await elementsSource.get(OBJECT_ID_LIST_INSTANCE_ID)

  if (!isInstanceElement(objectIdListElement)) {
    log.warn('object id list instance not found in elements source')
    return []
  }

  return collections.array.makeArray(objectIdListElement.value[OBJECT_ID_LIST_FIELD_NAME])
}
