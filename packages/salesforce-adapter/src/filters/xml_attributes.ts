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
import _ from 'lodash'
import {
  Element,
  isInstanceElement,
  isObjectType,
  InstanceElement,
  Values,
  ObjectType,
  Field,
} from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { IS_ATTRIBUTE, XML_ATTRIBUTE_PREFIX } from '../constants'
import { metadataType } from '../transformers/transformer'
import { metadataTypesWithAttributes } from '../transformers/xml_transformer'

const { awu } = collections.asynciterable
const isAttributeField = (field?: Field): boolean =>
  field?.annotations[IS_ATTRIBUTE] ?? false

const handleAttributeValues = (value: Values, type: ObjectType): Values => {
  if (!_.isPlainObject(value)) {
    return value
  }

  // We put the attributes first for backwards compatibility.
  const [attrEntries, entries] = _.partition(
    Object.entries(value),
    ([key, _val]) =>
      isAttributeField(type.fields[key.replace(XML_ATTRIBUTE_PREFIX, '')]),
  )
  return Object.fromEntries(
    attrEntries
      .map(([key, val]) => [key.slice(XML_ATTRIBUTE_PREFIX.length), val])
      .concat(entries),
  )
}

const removeAttributePrefix = async (
  instance: InstanceElement,
): Promise<void> => {
  const type = await instance.getType()
  instance.value = handleAttributeValues(instance.value, type)
  instance.value =
    (await transformValues({
      values: instance.value,
      type,
      strict: false,
      allowEmptyArrays: true,
      allowEmptyObjects: true,
      transformFunc: async ({ value, field }) => {
        const fieldType = await field?.getType()
        return isObjectType(fieldType)
          ? handleAttributeValues(value, fieldType)
          : value
      },
    })) ?? instance.value
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'xmlAttributesFilter',
  /**
   * Upon fetch remove the XML_ATTRIBUTE_PREFIX from the instance.value keys so it'll match the type
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async (inst) =>
        metadataTypesWithAttributes.includes(await metadataType(inst)),
      )
      .forEach(removeAttributePrefix)
  },
})

export default filterCreator
