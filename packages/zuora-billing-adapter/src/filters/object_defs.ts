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
  Element, ObjectType, isObjectType, ElemID, InstanceElement,
  ReferenceExpression, BuiltinTypes, isInstanceElement, Values,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { pathNaclCase, naclCase, extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import {
  ZUORA_BILLING, CUSTOM_OBJECT, CUSTOM_OBJECT_DEFINITION_TYPE, OBJECTS_PATH, METADATA_TYPE,
  STANDARD_OBJECT_DEFINITION_TYPE, CUSTOM_OBJECT_SUFFIX, LABEL, FIELD_RELATIONSHIP_ANNOTATIONS,
  REQUIRED, FILTERABLE, DESCRIPTION, INTERNAL_ID, STANDARD_OBJECT,
} from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)
const { isDefined } = lowerdashValues
const {
  toPrimitiveType, ADDITIONAL_PROPERTIES_FIELD,
} = elementUtils.swagger

// Check whether an element is a custom/standard object definition.
// Only relevant before the object_defs filter is run.
const isInstanceOfType = (
  element: Element,
  typeNames: string[],
): element is InstanceElement => (
  isInstanceElement(element)
  && typeNames.includes(element.type.elemID.name)
)

// Check whether an element is a custom object definition.
// Only relevant before the object_defs filter is run.
export const isInstanceOfCustomObjectDef = (element: Element): element is InstanceElement => (
  isInstanceOfType(element, [CUSTOM_OBJECT_DEFINITION_TYPE])
)

// Check whether an element is a custom/standard object definition.
// Only relevant before the object_defs filter is run.
const isInstanceOfObjectDef = (element: Element): element is InstanceElement => (
  isInstanceOfType(element, [STANDARD_OBJECT_DEFINITION_TYPE, CUSTOM_OBJECT_DEFINITION_TYPE])
)

// elem id renames are currently not allowed in Zuora, so we can use the elem id
// and don't need a dedicated annotation yet.
export const apiName = (elem: Element): string => elem.elemID.name

const isStandardObjectInstance = (inst: InstanceElement): boolean => (
  inst.elemID.typeName === STANDARD_OBJECT_DEFINITION_TYPE
)

const typeName = (inst: InstanceElement): string => (
  isStandardObjectInstance(inst)
    ? inst.elemID.name
    : `${inst.elemID.name}${CUSTOM_OBJECT_SUFFIX}`
)

const flattenAdditionalProperties = (val: Values): Values => ({
  ..._.omit(val, ADDITIONAL_PROPERTIES_FIELD),
  ...val[ADDITIONAL_PROPERTIES_FIELD],
})

const createObjectFromInstance = (inst: InstanceElement): ObjectType => {
  const {
    properties, required, filterable, description, Id, label,
  } = inst.value.schema
  const requiredFields = new Set(required)
  const filterableFields = new Set(filterable)
  const obj = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, typeName(inst)),
    fields: _.mapValues(
      flattenAdditionalProperties(properties),
      (prop, fieldName) => ({
        type: toPrimitiveType(prop.type),
        annotations: {
          ...flattenAdditionalProperties(prop),
          [REQUIRED]: requiredFields.has(fieldName),
          [FILTERABLE]: filterableFields.has(fieldName),
        },
      }),
    ),
    annotationTypes: _.assign(
      {},
      _.clone(inst.type.annotationTypes),
      {
        [METADATA_TYPE]: BuiltinTypes.STRING,
        [LABEL]: BuiltinTypes.STRING,
        [DESCRIPTION]: BuiltinTypes.STRING,
        [INTERNAL_ID]: BuiltinTypes.HIDDEN_STRING,
      }
    ),
    annotations: {
      [METADATA_TYPE]: isStandardObjectInstance(inst) ? STANDARD_OBJECT : CUSTOM_OBJECT,
      [LABEL]: label,
      [DESCRIPTION]: description,
      [INTERNAL_ID]: Id,
    },
    path: [ZUORA_BILLING, OBJECTS_PATH, pathNaclCase(naclCase(apiName(inst)))],
  })
  return obj
}

const addRelationships = (
  typesByLowercaseName: Record<string, ObjectType>,
  origInstancesByName: Record<string, InstanceElement>,
): void => {
  const findType = (objName: string): ObjectType | undefined => (
    typesByLowercaseName[objName.toLowerCase()]
  )

  Object.entries(origInstancesByName)
    .filter(([_name, inst]) => inst.value.schema.relationships !== undefined)
    .forEach(([name, inst]) => {
      const { relationships } = inst.value.schema
      const obj = findType(name)
      if (
        obj === undefined
        || !Array.isArray(relationships)
        || !relationships.every(_.isPlainObject)
      ) {
        return
      }
      const refObjectNames = new Set<string>()
      // sort in order to keep relationship fields list stable
      _.sortBy(
        relationships,
        'object', ({ fields }) => Object.values(fields.additionalProperties ?? {})[0]
      ).forEach(rel => {
        const {
          cardinality, namespace, object, fields, recordConstraints: constraints,
          ...additionalDetails
        } = rel
        if (cardinality === 'oneToMany') {
          // each relationship appears in both directions, so it's enough to look at manyToOne
          return
        }
        const referencedObjectName = namespace === 'default' ? `${object}${CUSTOM_OBJECT_SUFFIX}` : object
        refObjectNames.add(referencedObjectName)
        Object.entries(fields.additionalProperties ?? {}).forEach(([src, target]) => {
          const srcField = obj.fields[src]
          if (srcField === undefined) {
            log.error('Could not find field %s in object %s, not adding relationship', src, name)
            return
          }
          const targetObj = findType(referencedObjectName)
          const targetField = (
            _.isString(target) && targetObj?.fields[target]
              ? new ReferenceExpression(targetObj.fields[target].elemID)
              : `${referencedObjectName}.${target}`
          )
          srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.RELATIONSHIP_FIELDS] = [
            ...(srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.RELATIONSHIP_FIELDS] ?? []),
            targetField,
          ]
          srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.CARDINALITY] = cardinality
          srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.RECORD_CONSTRAINTS] = constraints
        })
        if (!_.isEmpty(additionalDetails)) {
          log.warn('Found unexpected additional details on type %s relationship', name)
        }
      })
      if (refObjectNames.size > 0) {
        extendGeneratedDependencies(
          obj,
          [...refObjectNames]
            .map(findType)
            .filter(isDefined)
            .map(refObj => new ReferenceExpression(refObj.elemID))
        )
      }
    })
}

/**
 * Custom objects filter.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    // ensure the custom object definition type was not accidentally renamed
    const customObjectDefType = elements.filter(isObjectType).find(
      e => apiName(e) === CUSTOM_OBJECT_DEFINITION_TYPE
    )
    if (customObjectDefType === undefined) {
      log.error('Could not find %s object type, skipping object defs filter', CUSTOM_OBJECT_DEFINITION_TYPE)
      return
    }

    const objectDefInstances = _.remove(elements, isInstanceOfObjectDef) as InstanceElement[]
    const defInstancesByName: Record<string, InstanceElement> = _.keyBy(
      objectDefInstances,
      typeName,
    )

    // type names are unique regardless of character case
    const typesByLowercaseName = _.mapKeys(
      _.mapValues(defInstancesByName, createObjectFromInstance),
      (_v, k) => k.toLowerCase(),
    )
    addRelationships(typesByLowercaseName, defInstancesByName)

    // TODO do we need additional checks before completely omitting the originals?
    elements.push(...Object.values(typesByLowercaseName))
  },
})

export default filterCreator
