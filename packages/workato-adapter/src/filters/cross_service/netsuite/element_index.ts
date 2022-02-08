/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, ElemID, InstanceElement, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'

const log = logger(module)
const { isPlainRecord, isDefined } = values

export type NetsuiteIndex = {
  scriptId: Record<string, ElemID>
  type: Record<string, Readonly<ObjectType>>
}

const CUSTOM_RECORD_TYPE = 'customrecordtype'
const CUSTOM_RECORD_CUSTOM_FIELDS = 'customrecordcustomfields'
const CUSTOM_RECORD_CUSTOM_FIELD = 'customrecordcustomfield'

export const indexNetsuiteByTypeAndScriptId = (
  elements: ReadonlyArray<Readonly<Element>>
): NetsuiteIndex => {
  const indexInstancesByScriptId = (): Record<string, ElemID> => {
    const toScriptId = (inst: Readonly<InstanceElement>): string | undefined => inst.value.scriptid
    const instances = elements.filter(isInstanceElement)

    const instanceIndex = _.mapValues(
      _.keyBy(
        instances.filter(e => toScriptId(e) !== undefined),
        e => toScriptId(e) as string,
      ),
      e => e.elemID,
    )

    const customRecordTypeInstances = instances.filter(
      inst => inst.elemID.typeName === CUSTOM_RECORD_TYPE
    )
    const nestedFields = (
      customRecordTypeInstances
        .flatMap(inst => (
          Object.entries(
            inst.value[CUSTOM_RECORD_CUSTOM_FIELDS]?.[CUSTOM_RECORD_CUSTOM_FIELD] ?? {}
          ).map(([key, item]) => {
            if (!isPlainRecord(item)) {
              log.warn(
                '%s is not a plain object as expected: %o',
                inst.elemID.createNestedID(
                  CUSTOM_RECORD_CUSTOM_FIELDS, CUSTOM_RECORD_CUSTOM_FIELD, key
                ).getFullName(),
                item
              )
              return undefined
            }
            return {
              scriptId: item.scriptid,
              nestedPath: inst.elemID.createNestedID(
                CUSTOM_RECORD_CUSTOM_FIELDS,
                CUSTOM_RECORD_CUSTOM_FIELD,
                key,
              ),
            }
          }).filter(isDefined)))
    )
    // TODO these should be replaced by maps or nested fields under custom objects - see SALTO-1078
    const customRecordTypeNestedFieldIndex = Object.fromEntries(
      nestedFields.map(f => [f.scriptId, f.nestedPath])
    )
    return {
      ...instanceIndex,
      ...customRecordTypeNestedFieldIndex,
    }
  }

  const indexTypesAndFields = (): Record<string, Readonly<ObjectType>> => {
    const types = elements.filter(isObjectType)
    return _.keyBy(
      // We can use the elem id (and not an apiName / scriptId annotation)
      // as long as we don't support renaming type elem ids
      types,
      e => e.elemID.name.toLowerCase(),
    )
  }

  return {
    scriptId: indexInstancesByScriptId(),
    type: indexTypesAndFields(),
  }
}
