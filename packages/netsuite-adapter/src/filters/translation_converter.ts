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
import { BuiltinTypes, Field, isInstanceElement, isInstanceChange, InstanceElement, Change, isField, ElemID, isObjectType } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, getPath, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterWith } from '../filter'
import { workbook } from '../autogen/types/custom_types/workbook'
import { translationcollection } from '../autogen/types/custom_types/translationcollection'
import { dataset } from '../autogen/types/custom_types/dataset'
import { ATTRIBUTE_PREFIX } from '../client/constants'
import { getMetadataTypes } from '../types'
import { NETSUITE } from '../constants'
import { centercategory } from '../autogen/types/custom_types/centercategory'
import { centertab } from '../autogen/types/custom_types/centertab'
import { subtab } from '../autogen/types/custom_types/subtab'

const { awu } = collections.asynciterable

const log = logger(module)

const FIELDS_TO_CONVERT = [
  workbook.elemID.createNestedID('field', 'name'),
  translationcollection.elemID.createNestedID('field', 'name'),
  dataset.elemID.createNestedID('field', 'name'),
  new ElemID(NETSUITE, 'centercategory_links_link', 'field', 'linklabel'),
  centercategory.elemID.createNestedID('field', 'label'),
  centertab.elemID.createNestedID('field', 'label'),
  subtab.elemID.createNestedID('field', 'title'),
]
const REAL_VALUE_KEY = '#text'
const TRANSLATE_KEY = 'translate'

const getTranslateFieldName = (key: string): string => `${key}Translate`

const addTranslateFields = (): void => {
  const types = _.keyBy(getMetadataTypes(), type => type.elemID.name)

  FIELDS_TO_CONVERT.forEach(elemID => {
    const type = types[elemID.typeName]

    if (!isObjectType(type)) {
      log.warn(`received non object type from ${elemID.getFullName()}`)
      return
    }
    const path = getPath(type, elemID)
    const field = path && _.get(type, path)
    if (!isField(field)) {
      log.warn(`Got a value that is not a field ${field} for elem ID ${elemID.getFullName()}`)
      return
    }
    field.parent.fields[getTranslateFieldName(field.name)] = new Field(
      type,
      getTranslateFieldName(field.name),
      BuiltinTypes.BOOLEAN
    )
  })
}

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  onFetch: async elements => {
    addTranslateFields()

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          strict: false,
          pathID: instance.elemID,
          transformFunc: ({ value }) => {
            if (!_.isPlainObject(value)) {
              return value
            }
            _(value)
              .entries()
              .filter(([_key, val]) => _.isPlainObject(val) && REAL_VALUE_KEY in val)
              .forEach(([key, val]) => {
                value[getTranslateFieldName(key)] = val[TRANSLATE_KEY] === 'T'
                value[key] = val[REAL_VALUE_KEY]
              })
            return value
          },
        }) ?? instance.value
      })
  },

  preDeploy: async changes =>
    awu(changes)
      .filter(isInstanceChange)
      .forEach(async change =>
        applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          async instance => {
            instance.value = await transformValues({
              values: instance.value,
              type: await instance.getType(),
              strict: false,
              pathID: instance.elemID,
              transformFunc: ({ value }) => {
                if (!_.isPlainObject(value)) {
                  return value
                }
                Object.entries(value)
                  .filter(([key]) => getTranslateFieldName(key) in value)
                  .forEach(([key, val]) => {
                    value[key] = {
                      [REAL_VALUE_KEY]: val,
                      [`${ATTRIBUTE_PREFIX}translate`]: value[getTranslateFieldName(key)] ? 'T' : 'F',
                    }
                    delete value[getTranslateFieldName(key)]
                  })
                return value
              },
            }) ?? instance.value
            return instance
          }
        )),
})

export default filterCreator
