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
  InstanceElement, Values, ObjectType, isObjectType, ReferenceExpression, isReferenceExpression,
  isListType,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { ADDITIONAL_PROPERTIES_FIELD } from './type_elements/swagger_parser'
import { InstanceCreationParams, toBasicInstance } from '../instance_elements'
import { TransformationConfig, TransformationDefaultConfig } from '../../config/transformation'

const log = logger(module)

/**
 * Extract standalone fields to their own instances, and convert the original value to a reference.
 */
const extractStandaloneFields = (
  inst: InstanceElement,
  {
    transformationConfigByType,
    transformationDefaultConfig,
  }: {
    transformationConfigByType: Record<string, TransformationConfig>
    transformationDefaultConfig: TransformationDefaultConfig
  },
): InstanceElement[] => {
  if (_.isEmpty(transformationConfigByType[inst.type.elemID.name]?.standaloneFields)) {
    return [inst]
  }
  const additionalInstances: InstanceElement[] = []

  const replaceWithReference = ({ value, parent, objType }: {
    value: Values
    parent: InstanceElement
    objType: ObjectType
  }): ReferenceExpression => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const [refInst] = generateInstancesForType({
      entries: [value],
      objType,
      nestName: true,
      parent,
      transformationConfigByType,
      transformationDefaultConfig,
    })
    additionalInstances.push(refInst)
    return new ReferenceExpression(refInst.elemID)
  }

  const extractFields: TransformFunc = ({ value, field, path }) => {
    if (field === undefined) {
      return value
    }
    const parentType = field.parent.elemID.name
    const { standaloneFields } = (
      transformationConfigByType[parentType]
      ?? transformationDefaultConfig
    )
    if (standaloneFields === undefined) {
      return value
    }
    const fieldExtractionDef = standaloneFields.find(def => def.fieldName === field.name)

    if (fieldExtractionDef !== undefined && !isReferenceExpression(value)) {
      const refType = isListType(field.type) ? field.type.innerType : field.type
      if (!isObjectType(refType)) {
        log.error(`unexpected type encountered when extracting nested fields - skipping path ${path} for instance ${inst.elemID.getFullName()}`)
        return value
      }

      if (Array.isArray(value)) {
        return value.map(val => replaceWithReference({
          value: val,
          parent: inst,
          objType: refType,
        }))
      }
      return replaceWithReference({
        value,
        parent: inst,
        objType: refType,
      })
    }
    return value
  }

  const updatedInst = transformElement({
    element: inst,
    transformFunc: extractFields,
    strict: false,
  })
  return [updatedInst, ...additionalInstances]
}

/**
 * Normalize the element's values:
 * - omit nulls
 * - nest additionalProperties under the additionalProperties field in order to align with the type
 *
 * Note: The reverse will need to be done pre-deploy (not implemented for fetch-only)
 */
const normalizeElementValues = (instance: InstanceElement): InstanceElement => {
  const transformAdditionalProps: TransformFunc = ({ value, field, path }) => {
    // removing nulls since they're not handled correctly in nacls
    if (value === null) {
      return undefined
    }

    const fieldType = path?.isEqual(instance.elemID) ? instance.type : field?.type
    if (
      !isObjectType(fieldType)
      || fieldType.fields[ADDITIONAL_PROPERTIES_FIELD] === undefined
    ) {
      return value
    }

    const additionalProps = _.pickBy(value, (_val, key) => (
      !(
        Object.keys(fieldType.fields).includes(key)
        || Object.keys(fieldType.annotationTypes).includes(key)
      )
    ))
    return {
      ..._.omit(value, Object.keys(additionalProps)),
      [ADDITIONAL_PROPERTIES_FIELD]: additionalProps,
    }
  }

  return transformElement({
    element: instance,
    transformFunc: transformAdditionalProps,
    strict: false,
  })
}

const toInstance = (args: InstanceCreationParams): InstanceElement => (
  normalizeElementValues(toBasicInstance(args))
)

/**
 * Generate instances for the specified types based on the entries from the API responses,
 * using the endpoint's specific config and the adapter's defaults.
 */
export const generateInstancesForType = ({
  entries,
  objType,
  nestName,
  parent,
  transformationConfigByType,
  transformationDefaultConfig,
}: {
  entries: Values[]
  objType: ObjectType
  nestName?: boolean
  parent?: InstanceElement
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
}): InstanceElement[] => {
  const standaloneFields = transformationConfigByType[objType.elemID.name]?.standaloneFields
  return entries
    .map((entry, index) => toInstance({
      entry,
      type: objType,
      nestName,
      parent,
      transformationConfigByType,
      transformationDefaultConfig,
      defaultName: `unnamed_${index}`, // TODO improve
    }))
    .flatMap(inst => (
      standaloneFields === undefined
        ? [inst]
        : extractStandaloneFields(inst, {
          transformationConfigByType,
          transformationDefaultConfig,
        })
    ))
}
