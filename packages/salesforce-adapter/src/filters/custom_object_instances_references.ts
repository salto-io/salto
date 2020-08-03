/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import {
  Element, isInstanceElement, Values, ObjectType, Field, isPrimitiveType, InstanceElement,
  ReferenceExpression,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { isCustomObject, Types, apiName } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, CUSTOM_OBJECT_ID_FIELD } from '../constants'

const { makeArray } = collections.array

const replaceReferenceValues = (
  values: Values,
  type: ObjectType,
  instances: InstanceElement[]
): Values => {
  const shouldReplace = (field: Field): boolean => (
    isPrimitiveType(field.type)
    && (
      Types.primitiveDataTypes.Lookup.isEqual(field.type)
      || Types.primitiveDataTypes.MasterDetail.isEqual(field.type)
    )
  )

  const instancesByType = _.mapValues(
    _.groupBy(
      instances,
      instance => apiName(instance.type, true)
    ),
    typeInstances =>
      _.keyBy(
        typeInstances,
        inst => inst.value[CUSTOM_OBJECT_ID_FIELD]
      )
  ) as Record<string, Record<string, InstanceElement>>

  const transformFunc: TransformFunc = ({ value, field }) => {
    if (_.isUndefined(field) || !shouldReplace(field)) {
      return value
    }
    const refTo = makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
    const refTarget = refTo
      .map(typeRef => (
        isReferenceExpression(typeRef)
          ? instancesByType[typeRef.elemId.typeName]?.[value]
          : instancesByType[typeRef]?.[value]
      ))
      .filter(lowerdashValues.isDefined)
      .pop()
    return refTarget === undefined ? value : new ReferenceExpression(refTarget.elemID)
  }

  return transformValues(
    {
      values,
      type,
      transformFunc,
      strict: false,
    }
  ) ?? values
}

const replaceLookupsWithReferences = (elements: Element[]): void => {
  const customObjectInstances = elements
    .filter(isInstanceElement)
    .filter(e => isCustomObject(e.type))
  customObjectInstances.forEach(instance => {
    instance.value = replaceReferenceValues(
      instance.value,
      instance.type,
      customObjectInstances,
    )
  })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    replaceLookupsWithReferences(elements)
  },
})

export default filter
