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
import {
  Element, InstanceElement, isInstanceElement, ReferenceExpression, isField, ElemID,
} from '@salto-io/adapter-api'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { SETTINGS_TYPE_PREFIX, TASK_TYPE } from '../constants'
import { FilterCreator } from '../filter'
import { getObjectDefs, getTypeNameAsReferenced, isObjectDef } from '../element_utils'

const { flatMapAsync, toAsyncIterable } = collections.asynciterable

type ObjectFieldDependency = {
  typeReferencePath: string[]
  fieldReferencePath?: string[]
  parentTypes: string[]
}

const dependencies: ObjectFieldDependency[] = [
  {
    typeReferencePath: ['object'],
    parentTypes: [TASK_TYPE],
  },
  {
    typeReferencePath: ['object'],
    fieldReferencePath: ['field'],
    parentTypes: [`${SETTINGS_TYPE_PREFIX}Segment`],
  },
]

const addObjectFieldDependency = (
  inst: InstanceElement,
  typeLowercaseLookup: multiIndex.Index<[string], ElemID>,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
  typeReferencePath: string[],
  fieldReferencePath?: string[],
): void => {
  const typeElemId = inst.elemID.createNestedID(...typeReferencePath)
  const typeName = resolvePath(inst, typeElemId)
  if (!_.isString(typeName)) {
    return
  }

  const objId = typeLowercaseLookup.get(typeName.toLowerCase())
  if (_.isUndefined(objId)) {
    return
  }

  setPath(inst, typeElemId, new ReferenceExpression(objId))

  if (_.isUndefined(fieldReferencePath)) {
    return
  }

  const fieldElemId = inst.elemID.createNestedID(...fieldReferencePath)
  const fieldName = resolvePath(inst, fieldElemId)
  if (!_.isString(fieldName)) {
    return
  }

  const fieldId = fieldLowercaseLookup.get(typeName.toLowerCase(), fieldName.toLowerCase())
  if (_.isUndefined(fieldId)) {
    return
  }

  setPath(inst, fieldElemId, new ReferenceExpression(fieldId))
}

/**
 * Add references to fields that represent objects and fields.
 */
const filterCreator: FilterCreator = () => ({
  name: 'objectReferencesFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const objectDefs = await getObjectDefs(elements)
    const {
      typeLowercaseLookup, fieldLowercaseLookup,
    } = await multiIndex.buildMultiIndex<Element>()
      .addIndex({
        name: 'typeLowercaseLookup',
        filter: isObjectDef,
        key: async type => [await getTypeNameAsReferenced(type)],
        map: type => type.elemID,
      })
      .addIndex({
        name: 'fieldLowercaseLookup',
        filter: isField,
        key: async field => [
          await getTypeNameAsReferenced(field.parent), field.elemID.name.toLowerCase(),
        ],
        map: field => field.elemID,
      })
      .process(
        flatMapAsync(toAsyncIterable(objectDefs), obj => [obj, ...Object.values(obj.fields)])
      )

    const instances = elements.filter(isInstanceElement)
    dependencies.forEach(dependency => {
      const dependentInstances = instances.filter(inst =>
        dependency.parentTypes.includes(inst.elemID.typeName))
      if (!_.isEmpty(dependentInstances)) {
        dependentInstances.forEach(instance => addObjectFieldDependency(
          instance,
          typeLowercaseLookup,
          fieldLowercaseLookup,
          dependency.typeReferencePath,
          dependency.fieldReferencePath
        ))
      }
    })
  },
})

export default filterCreator
