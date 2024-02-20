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
import {
  ElemIdGetter,
  InstanceElement,
  ReferenceExpression,
  getDeepInnerTypeSync,
  isObjectType,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { TransformFuncSync, invertNaclCase, transformValuesSync } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'
import { createInstance, getInstanceCreationFunctions } from './instance_utils'

const extractStandaloneInstancesFromField =
  ({
    defQuery,
    instanceOutput,
    getElemIdFunc,
    parent,
  }: {
    defQuery: ElementAndResourceDefFinder
    instanceOutput: InstanceElement[]
    getElemIdFunc?: ElemIdGetter
    parent: InstanceElement
  }): TransformFuncSync =>
  ({ value, field }) => {
    if (field === undefined || isReferenceExpression(value)) {
      return value
    }
    const parentType = field.parent.elemID.name
    const standaloneDef = defQuery.query(parentType)?.element?.fieldCustomizations?.[field.name]?.standalone
    if (standaloneDef?.typeName === undefined) {
      return value
    }

    const fieldType = getDeepInnerTypeSync(field.getTypeSync())
    if (!isObjectType(fieldType)) {
      throw new Error(`field type for ${field.elemID.getFullName()} is not an object type`)
    }
    if (fieldType.elemID.name !== standaloneDef.typeName) {
      throw new Error(
        `unexpected field type for ${field.elemID.getFullName()} (expected: ${standaloneDef.typeName} but found: ${fieldType.elemID.name})`,
      )
    }

    const { toElemName, toPath } = getInstanceCreationFunctions({ defQuery, type: fieldType, getElemIdFunc })
    const newInstances = collections.array.makeArray(value).map((entry, index) =>
      createInstance({
        entry,
        type: fieldType,
        toElemName,
        toPath,
        defaultName: `${invertNaclCase(parent.elemID.name)}__unnamed_${index}`,
        parent: standaloneDef.addParentAnnotation !== false ? parent : undefined,
        nestUnderPath: standaloneDef.nestPathUnderParent
          ? [...(parent.path?.slice(2, parent.path?.length - 1) ?? []), field.name]
          : undefined,
      }),
    )
    newInstances.forEach(inst => instanceOutput.push(inst))

    if (standaloneDef.referenceFromParent === false) {
      return undefined
    }
    const refs = newInstances.map(inst => new ReferenceExpression(inst.elemID, inst))
    if (Array.isArray(value)) {
      return refs
    }
    return refs[0]
  }

/**
 * Extract fields marked as standalone into their own instances.
 * - if standalone.referenceFromParent=true, the original value is converted to a reference - otherwise it's omitted.
 * - if standalone.addParentAnnotation=true, the newly-created instance gets a parent annotation.
 *
 * Note: modifies the instances array in-place.
 */
export const extractStandaloneInstances = ({
  instances,
  defQuery,
  getElemIdFunc,
}: {
  instances: InstanceElement[]
  defQuery: ElementAndResourceDefFinder
  getElemIdFunc?: ElemIdGetter
}): InstanceElement[] => {
  const instancesToProcess: InstanceElement[] = []
  instances.forEach(inst => instancesToProcess.push(inst))
  const outInstances: InstanceElement[] = []

  while (instancesToProcess.length > 0) {
    const inst = instancesToProcess.pop()
    if (inst === undefined) {
      // cannot happen
      break
    }
    outInstances.push(inst)
    const value = transformValuesSync({
      values: inst.value,
      type: inst.getTypeSync(),
      strict: false,
      pathID: inst.elemID,
      transformFunc: extractStandaloneInstancesFromField({
        defQuery,
        instanceOutput: instancesToProcess,
        getElemIdFunc,
        parent: inst,
      }),
    })
    if (value !== undefined) {
      inst.value = value
    }
  }
  return outInstances
}
