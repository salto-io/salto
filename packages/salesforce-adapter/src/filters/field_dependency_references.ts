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
import {
  Change,
  Element, Field,
  InstanceElement, isInstanceElement, isObjectType, ObjectType,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { apiName, isCustomObject, isInstanceOfCustomObject } from '../transformers/transformer'

const { awu, groupByAsync } = collections.asynciterable
const { isDefined } = values

const FIELD_DEPENDENCY = 'fieldDependency'

const getFieldsWithDependency = (customObject: ObjectType): Field[] => (
  Object.values(customObject.fields)
    .filter(field => Object.keys(field.annotations).includes(FIELD_DEPENDENCY))
)

const filter: LocalFilterCreator = () => {
  let originalChanges: Record<string, Change<InstanceElement>>
  return {
    onFetch: async (elements: Element[]) => {
      const customObjects = await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .toArray()
      const fieldsWithDependency = customObjects.flatMap(getFieldsWithDependency)
      const objectNameToFields = await groupByAsync(fieldsWithDependency, async field => apiName(await field.getType()))
      const relevantCustomObjects = await awu(customObjects)
        .filter(async customObject => isDefined(objectNameToFields[await apiName(customObject)]))
        .toArray()
      const relevantInstances = await awu(elements)
        .filter(isInstanceElement)
        .filter(isInstanceOfCustomObject)
        .filter(async instance => relevantCustomObjects.includes(await instance.getType()))
        .toArray()
      console.log(relevantInstances)
    },
    preDeploy: async changes => {
      console.log(changes, originalChanges)
    },
    onDeploy: async changes => {
      console.log(changes)
    },
  }
}

export default filter
