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
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import {
  Element, isInstanceElement, Values, ObjectType, Field, isPrimitiveType, Value, InstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { isCustomObject, Types, apiName } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, CUSTOM_OBJECT_ID_FIELD } from '../constants'

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

  const replacer = (val: Value, field: Field): Value => {
    if (field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO] === undefined
        || !_.isArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])) {
      return val
    }
    const refToInstance = instances.find(instance =>
      field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO].includes(apiName(instance.type, true))
      && instance.value[CUSTOM_OBJECT_ID_FIELD] === val)
    return (refToInstance === undefined) ? val : new ReferenceExpression(refToInstance.elemID)
  }

  const transformFunc: TransformFunc = ({ value, field }) => (
    !_.isUndefined(field) && shouldReplace(field) ? replacer(value, field) : value
  )

  return transformValues(
    {
      values,
      type,
      transformFunc,
      strict: false,
    }
  ) || values
}

const replaceLookupsWithReferences = (elements: Element[]): void => {
  const customObjectInstances = elements.filter(isInstanceElement)
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
