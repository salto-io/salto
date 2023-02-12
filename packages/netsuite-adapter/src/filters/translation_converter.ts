/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, Field, isInstanceElement, isField, ElemID, isObjectType, TypeElement, isType, Element, getChangeData } from '@salto-io/adapter-api'
import { elementAnnotationTypes, getPath, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterWith } from '../filter'
import { ATTRIBUTE_PREFIX } from '../client/constants'
import { CENTER_CATEGORY, CENTER_TAB, DATASET, NETSUITE, SUBTAB, TRANSLATION_COLLECTION, WORKBOOK } from '../constants'
import { isCustomRecordType } from '../types'

const { awu } = collections.asynciterable

const log = logger(module)

const FIELDS_TO_CONVERT = [
  new ElemID(NETSUITE, WORKBOOK, 'field', 'name'),
  new ElemID(NETSUITE, TRANSLATION_COLLECTION, 'field', 'name'),
  new ElemID(NETSUITE, DATASET, 'field', 'name'),
  new ElemID(NETSUITE, 'centercategory_links_link', 'field', 'linklabel'),
  new ElemID(NETSUITE, CENTER_CATEGORY, 'field', 'label'),
  new ElemID(NETSUITE, CENTER_TAB, 'field', 'label'),
  new ElemID(NETSUITE, SUBTAB, 'field', 'title'),
]
const REAL_VALUE_KEY = '#text'
const TRANSLATE_KEY = 'translate'

const getTranslateFieldName = (key: string): string => `${key}Translate`

const addTranslateFields = (typeElements: TypeElement[]): void => {
  const types = _.keyBy(typeElements, type => type.elemID.name)

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

const transformAnnotationsAndValues = async (
  element: Element,
  transformFunc: TransformFunc
): Promise<void> => {
  if (isInstanceElement(element)) {
    element.value = await transformValues({
      values: element.value,
      type: await element.getType(),
      strict: false,
      transformFunc,
    }) ?? {}
  }
  if (isObjectType(element)) {
    await awu(Object.values(element.fields)).forEach(async field => {
      field.annotations = await transformValues({
        values: field.annotations,
        type: await elementAnnotationTypes(field),
        strict: false,
        transformFunc,
      }) ?? {}
    })
  }
  element.annotations = await transformValues({
    values: element.annotations,
    type: await elementAnnotationTypes(element),
    strict: false,
    transformFunc,
  }) ?? {}
}

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  name: 'translationConverter',
  onFetch: async elements => {
    addTranslateFields(elements.filter(isType))

    await awu(elements).filter(element => isInstanceElement(element) || (
      isObjectType(element) && isCustomRecordType(element)
    )).forEach(async element => {
      await transformAnnotationsAndValues(element, ({ value }) => {
        if (!_.isPlainObject(value)) {
          return value
        }
        _(value)
          .entries()
          .filter(([_key, val]) => _.isPlainObject(val) && REAL_VALUE_KEY in val)
          .forEach(([key, val]) => {
            value[getTranslateFieldName(key)] = (
              val[TRANSLATE_KEY] === true || val[TRANSLATE_KEY] === 'T'
            )
            value[key] = val[REAL_VALUE_KEY]
          })
        return value
      })
    })
  },

  preDeploy: async changes => {
    const elementsToTransform = changes
      .map(getChangeData)
      .filter(element => isInstanceElement(element) || (
        isObjectType(element) && isCustomRecordType(element)
      ))
    await awu(elementsToTransform)
      .forEach(async element => {
        await transformAnnotationsAndValues(element, ({ value }) => {
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
        })
      })
  },
})

export default filterCreator
