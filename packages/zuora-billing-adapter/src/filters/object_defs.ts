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
  Element, ObjectType, isObjectType, ElemID, InstanceElement,
  ReferenceExpression, BuiltinTypes, Values,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { pathNaclCase, naclCase, extendGeneratedDependencies, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues, promises } from '@salto-io/lowerdash'
import {
  ZUORA_BILLING, CUSTOM_OBJECT, CUSTOM_OBJECT_DEFINITION_TYPE, OBJECTS_PATH, METADATA_TYPE,
  STANDARD_OBJECT_DEFINITION_TYPE, CUSTOM_OBJECT_SUFFIX, LABEL, OBJECT_TYPE,
  FIELD_RELATIONSHIP_ANNOTATIONS, REQUIRED, FILTERABLE, DESCRIPTION, INTERNAL_ID, STANDARD_OBJECT,
} from '../constants'
import { FilterCreator } from '../filter'
import { isInstanceOfType } from '../element_utils'

const log = logger(module)
const { isDefined } = lowerdashValues
const {
  toPrimitiveType, ADDITIONAL_PROPERTIES_FIELD,
} = elementUtils.swagger
const { mapValuesAsync } = promises.object
// Check whether an element is a custom/standard object definition.
// Only relevant before the object_defs filter is run.
const isInstanceOfObjectDef = (element: Element): element is InstanceElement => (
  isInstanceOfType(element, [STANDARD_OBJECT_DEFINITION_TYPE, CUSTOM_OBJECT_DEFINITION_TYPE])
)

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

const createObjectFromInstance = async (inst: InstanceElement): Promise<ObjectType> => {
  const { schema, type } = inst.value
  const {
    properties, required, filterable, description, label,
  } = schema
  const requiredFields = new Set(required)
  const filterableFields = new Set(filterable)
  const obj = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, typeName(inst)),
    fields: _.mapValues(
      flattenAdditionalProperties(properties),
      (prop, fieldName) => ({
        refType: toPrimitiveType(prop.type),
        annotations: {
          ...flattenAdditionalProperties(prop),
          [REQUIRED]: requiredFields.has(fieldName),
          [FILTERABLE]: filterableFields.has(fieldName),
        },
      }),
    ),
    annotationRefsOrTypes: {
      ...await (await inst.getType()).getAnnotationTypes(),
      [METADATA_TYPE]: BuiltinTypes.STRING,
      [LABEL]: BuiltinTypes.STRING,
      [DESCRIPTION]: BuiltinTypes.STRING,
      [INTERNAL_ID]: BuiltinTypes.HIDDEN_STRING,
      [OBJECT_TYPE]: BuiltinTypes.STRING,
    },
    annotations: {
      [METADATA_TYPE]: isStandardObjectInstance(inst) ? STANDARD_OBJECT : CUSTOM_OBJECT,
      [LABEL]: label,
      [DESCRIPTION]: description,
      [INTERNAL_ID]: inst.value.additionalProperties?.Id,
      [OBJECT_TYPE]: type,
    },
    // id name changes are currently not allowed so it's ok to use the elem id
    path: [ZUORA_BILLING, OBJECTS_PATH, pathNaclCase(naclCase(inst.elemID.name))],
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
        // the only cardinalities currently in use are oneToMany / manyToOne
        if (cardinality === 'oneToMany') {
          // each relationship appears in both directions, so it's enough to look at manyToOne
          return
        }
        const referencedObjectName = namespace === 'default' ? `${object}${CUSTOM_OBJECT_SUFFIX}` : object
        refObjectNames.add(referencedObjectName)
        Object.entries(fields.additionalProperties ?? {}).forEach(([src, target]) => {
          const srcField = obj.fields[src]
          if (srcField === undefined) {
            log.warn('Could not find field %s in object %s, not adding relationship', src, name)
            return
          }
          const targetObj = findType(referencedObjectName)
          const targetField = (
            _.isString(target) && targetObj?.fields[target]
              ? new ReferenceExpression(targetObj.fields[target].elemID)
              : `${referencedObjectName}.${target}`
          )
          // we assume each field can be listed in at most one relatioship, so it's ok to override
          // these annotations
          if (srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.REFERENCE_TO] !== undefined) {
            log.info('Field %s already has referenceTo defined, extending', srcField.elemID.getFullName())
          }
          srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.REFERENCE_TO] = [
            ...(srcField.annotations[FIELD_RELATIONSHIP_ANNOTATIONS.REFERENCE_TO] ?? []),
            targetField,
          ]
          if ([
            FIELD_RELATIONSHIP_ANNOTATIONS.CARDINALITY,
            FIELD_RELATIONSHIP_ANNOTATIONS.RECORD_CONSTRAINTS,
          ].some(anno => srcField.annotations[anno] !== undefined)) {
            log.warn(
              'Field %s already has annotation values %s, overriding',
              srcField.elemID.getFullName(),
              safeJsonStringify(_.pick(srcField.annotations, [
                FIELD_RELATIONSHIP_ANNOTATIONS.CARDINALITY,
                FIELD_RELATIONSHIP_ANNOTATIONS.RECORD_CONSTRAINTS,
              ])),
            )
          }
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
            .map(refObj => ({ reference: new ReferenceExpression(refObj.elemID) }))
        )
      }
    })
}

/**
 * Custom objects filter.
 */
const filterCreator: FilterCreator = () => ({
  name: 'customObjectsFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    // ensure the custom object definition type was not accidentally renamed
    const customObjectDefType = elements.filter(isObjectType).find(
      e => e.elemID.name === CUSTOM_OBJECT_DEFINITION_TYPE
    )
    if (customObjectDefType === undefined) {
      log.warn('Could not find %s object type, skipping object defs filter', CUSTOM_OBJECT_DEFINITION_TYPE)
      return
    }

    const objectDefInstances = _.remove(elements, isInstanceOfObjectDef) as InstanceElement[]
    const defInstancesByName: Record<string, InstanceElement> = _.keyBy(
      objectDefInstances,
      typeName,
    )

    // type names are unique regardless of character case
    const defInstancesObjects = await mapValuesAsync(defInstancesByName, createObjectFromInstance)
    const typesByLowercaseName = _.mapKeys(
      defInstancesObjects,
      (_v, k) => k.toLowerCase(),
    )
    addRelationships(typesByLowercaseName, defInstancesByName)

    elements.push(...Object.values(typesByLowercaseName))
  },
})

export default filterCreator
