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
import _ from 'lodash'
import { isInstanceElement, isObjectType, Values } from '@salto-io/adapter-api'
import { transformElementAnnotations, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections, regex } from '@salto-io/lowerdash'
import { FilterCreator, FilterWith } from '../filter'
import { FieldToOmitParams } from '../query'
import { CUSTOM_RECORD_TYPE } from '../constants'
import { isCustomRecordType } from '../types'
import { CUSTOM_FIELDS_LIST } from '../custom_records/custom_record_type'

const { awu } = collections.asynciterable
const { isFullRegexMatch } = regex

const FIELDS_TO_OMIT: FieldToOmitParams[] = []

const filterCreator: FilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  name: 'omitFieldsFilter',
  onFetch: async elements => {
    const fieldsToOmit = FIELDS_TO_OMIT.concat(config.fetch?.fieldsToOmit ?? [])

    if (fieldsToOmit.length === 0) {
      return
    }

    const typeNames = elements.filter(isObjectType).map(elem => elem.elemID.name).concat(CUSTOM_FIELDS_LIST)
    const fieldsToOmitByType = Object.fromEntries(
      typeNames.map((typeName: string): [string, string[]] => [
        typeName,
        fieldsToOmit
          .filter(({ type, subtype }) => isFullRegexMatch(typeName, subtype !== undefined ? subtype : type))
          .flatMap(params => params.fields),
      ]).filter(([_t, fields]) => fields.length > 0)
    )

    if (_.isEmpty(fieldsToOmitByType)) {
      return
    }

    const typesForDeepTransformation = new Set(
      typeNames.filter(typeName => fieldsToOmit
        .some(({ type, subtype }) => subtype !== undefined && subtype !== type && isFullRegexMatch(typeName, type)))
    )

    const omitValues = (value: Values, typeName: string): Values => (
      typeName in fieldsToOmitByType
        ? _.omitBy(value, (_val, key) => fieldsToOmitByType[typeName]
          .some(fieldToOmit => isFullRegexMatch(key, fieldToOmit)))
        : value
    )

    const transformFunc: TransformFunc = async ({ value, field }) => {
      if (!_.isPlainObject(value)) {
        return value
      }
      const fieldType = await field?.getType()
      if (!isObjectType(fieldType)) {
        return value
      }
      return omitValues(value, fieldType.elemID.name)
    }

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value = omitValues(instance.value, instance.elemID.typeName)
        if (typesForDeepTransformation.has(instance.elemID.typeName)) {
          instance.value = await transformValues({
            values: instance.value,
            type: await instance.getType(),
            transformFunc,
            strict: false,
          }) ?? {}
        }
      })

    await awu(elements)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .forEach(async type => {
        type.annotations = omitValues(type.annotations, CUSTOM_RECORD_TYPE)
        if (typesForDeepTransformation.has(CUSTOM_RECORD_TYPE)) {
          type.annotations = await transformElementAnnotations({
            element: type,
            transformFunc,
            strict: false,
          })
        }
        Object.values(type.fields).forEach(field => {
          field.annotations = omitValues(field.annotations, CUSTOM_FIELDS_LIST)
        })
      })
  },
})

export default filterCreator
