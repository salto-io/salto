/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  InstanceElement, Values, ObjectType,
} from '@salto-io/adapter-api'
import { pathNaclCase, naclCase } from '../../nacl_case_utils'
import { RECORDS_PATH } from '../constants'
import { transformValues } from '../../utils'

const ID_SEPARATOR = '__'

/**
 * Generate an instance for a single entry returned for a given type.
 *
 * - The elem id is determined based on the name field, with a fallback
 *    to a default name that might not be multienv-friendly.
 * - Special case: If hasDynamicFields is specified, then the entry is
 *    nested under a 'value' field in order to allow the type to define
 *    this as a map type.
 */
export const toInstance = ({
  adapterName,
  entry,
  type,
  nameField,
  pathField,
  defaultName,
  fieldsToOmit,
  hasDynamicFields,
  nameSuffix,
}: {
  adapterName: string
  entry: Values
  type: ObjectType
  nameField: string
  pathField?: string
  defaultName: string
  fieldsToOmit?: string[]
  hasDynamicFields?: boolean
  nameSuffix?: string
}): InstanceElement | undefined => {
  const name = entry[nameField] ?? defaultName
  const path = ((pathField && _.isString(entry[pathField]))
    ? entry[pathField]
    : undefined)
  const entryData = fieldsToOmit !== undefined
    ? _.omit(entry, fieldsToOmit)
    : entry

  if (_.isEmpty(entryData)) {
    return undefined
  }

  const naclName = naclCase(String(
    nameSuffix
      ? `${name}${ID_SEPARATOR}${nameSuffix}`
      : name
  ))
  return new InstanceElement(
    naclName,
    type,
    transformValues({
      values: hasDynamicFields ? { value: entryData } : entryData,
      type,
      // omit nulls from returned value
      transformFunc: ({ value }) => (value === null ? undefined : value),
      strict: false,
    }),
    [
      adapterName,
      RECORDS_PATH,
      pathNaclCase(type.elemID.name),
      (path ? pathNaclCase(naclCase(path)) : pathNaclCase(naclName)).slice(0, 100),
    ],
  )
}
