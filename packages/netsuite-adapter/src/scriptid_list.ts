/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
import { NETSUITE } from './constants'
import { ObjectID } from './config/types'

const log = logger(module)

export const SCRIPT_ID_LIST_TYPE_NAME = 'scriptid_list'

const SCRIPT_ID_LIST_TYPE_ID = new ElemID(NETSUITE, SCRIPT_ID_LIST_TYPE_NAME)
const SCRIPT_ID_LIST_INSTANCE_ID = new ElemID(NETSUITE, SCRIPT_ID_LIST_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

const scriptIdListObjectType = new ObjectType({
  elemID: SCRIPT_ID_LIST_TYPE_ID,
  isSettings: true,
  fields: {
    scriptid_list: { refType: new ListType(BuiltinTypes.STRING) },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

export const createScriptIdListElements = (instancesIds: ObjectID[]): [ObjectType, InstanceElement] => {
  log.debug('Creating script id list elements')
  const instance = new InstanceElement(
    ElemID.CONFIG_NAME,
    scriptIdListObjectType,
    { scriptid_list: instancesIds.map(id => id.instanceId) },
    undefined,
    {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  )

  return [scriptIdListObjectType, instance]
}

const getExistingScriptIdListElements = async (
  instancesIds: ObjectID[],
  elementsSource: ReadOnlyElementsSource,
): Promise<[ObjectType, InstanceElement]> => {
  const instance = await elementsSource.get(SCRIPT_ID_LIST_INSTANCE_ID)
  if (!isInstanceElement(instance)) {
    log.warn('script id list instance not found in elements source')
    return createScriptIdListElements(instancesIds)
  }
  // Resolve the type of the instance cause it's used inside the adapter that assumes resolved types
  instance.refType = createRefToElmWithValue(scriptIdListObjectType)

  return [scriptIdListObjectType, instance]
}

export const getOrCreateScriptIdListElements = async (
  instancesIds: ObjectID[],
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<[ObjectType, InstanceElement]> =>
  isPartial ? getExistingScriptIdListElements(instancesIds, elementsSource) : createScriptIdListElements(instancesIds)

export const getScriptIdList = async (elementsSource: ReadOnlyElementsSource): Promise<string[]> => {
  const scriptIdListElement = await elementsSource.get(SCRIPT_ID_LIST_INSTANCE_ID)

  if (!isInstanceElement(scriptIdListElement)) {
    log.warn('scriptid list instance not found in elements source')
    return []
  }

  return collections.array.makeArray(scriptIdListElement.value.scriptid_list)
}
