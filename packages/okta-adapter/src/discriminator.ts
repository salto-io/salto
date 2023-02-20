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
import Joi from 'joi'
import { ObjectType, Values, isObjectType, InstanceElement, Change } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, POLICY_RULE_TYPE_NAME, POLICY_TYPE_NAME } from './constants'

const { awu } = collections.asynciterable
const log = logger(module)

const TYPE_TO_MAPPING_FIELD: Record<string, string> = {
  [APPLICATION_TYPE_NAME]: 'signOnMode',
  [POLICY_TYPE_NAME]: 'type',
  [POLICY_RULE_TYPE_NAME]: 'type',
}

const DISCRIMINATOR_SCHEME = Joi.object({
  discriminator: Joi.object({
    propertyName: Joi.string().required(),
    mapping: Joi.object().pattern(Joi.string(), Joi.string()).unknown(true).required(),
  }).required(),
}).unknown(true)

const hasDiscriminator = (schema: unknown): schema is elementUtils.swagger.V3SchemaObject => {
  const { error } = DISCRIMINATOR_SCHEME.validate(schema)
  return error === undefined
}

/**
 * Extract type schemas for types defined with 'discriminator' keyword in okta's swagger file
 */
export const getDiscriminatorFields = (
  schemaDef: elementUtils.swagger.SchemaObject
): Record<string, elementUtils.swagger.PropertyDetails> | undefined => {
  if (hasDiscriminator(schemaDef)) {
    const mapping = schemaDef.discriminator?.mapping
    if (mapping !== undefined) {
      const discriminatorProps = _.mapValues(mapping, value => ({ $ref: value, inheritParentProps: false }))
      return discriminatorProps
    }
  }
  return undefined
}

const getNestedTypeFields = async (type: ObjectType, discriminator: string): Promise<string[]> => {
  const nestedType = await type.fields[discriminator].getType()
  if (!isObjectType(nestedType)) {
    throw new Error('Received unexpected TypeElement')
  }
  return Object.keys(nestedType.fields)
}

/**
 * Align entries structure to the corresponding object type definitions
 * for types that include nested types defined with 'discriminator' keword in okta's swagger file
 */
export const getDiscriminatorTypeEntries = async (entries: Values[], type: ObjectType): Promise<Values[]> => {
  if (!Object.keys(TYPE_TO_MAPPING_FIELD).includes(type.elemID.name)) {
    return entries
  }
  const discriminatorField = TYPE_TO_MAPPING_FIELD[type.elemID.name]
  const discValueToTypeFields: Record<string, string[]> = {}
  const newEntries = await awu(entries).map(async entry => {
    const discriminatorValue = entry[discriminatorField]
    if (!_.isString(discriminatorValue)) {
      log.warn(`Received unexpected field ${discriminatorField} in entry ${entry} of type ${type.elemID.name}`)
      return entry
    }
    if (discValueToTypeFields[discriminatorValue] === undefined) {
      try {
        discValueToTypeFields[discriminatorValue] = await getNestedTypeFields(type, discriminatorValue)
      } catch (e) {
        log.warn(`Could not find nested type for field ${discriminatorValue} in type ${type.elemID.name}`)
        return entry
      }
    }
    const newEntry = _.omit(entry, discValueToTypeFields[discriminatorValue])
    _.set(newEntry, discriminatorValue, _.pick(entry, discValueToTypeFields[discriminatorValue]))
    return newEntry
  }).toArray()
  return newEntries
}

/**
 * Remove discriminator field from instance before deploy
 * and move all discriminator nested fields to the to level value
 */
export const flattenDiscriminatorFields = async (change: Change<InstanceElement>): Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData(
    change,
    instance => {
      if (!Object.keys(TYPE_TO_MAPPING_FIELD).includes(instance.elemID.typeName)) {
        return instance
      }
      const discriminatorField = TYPE_TO_MAPPING_FIELD[instance.elemID.typeName]
      const discriminatorFieldValue = instance.value[discriminatorField]
      if (!_.isString(discriminatorFieldValue)) {
        log.warn(`Received unexpected value in field ${discriminatorField}`)
        return instance
      }
      const discriminatorObject = instance.value[discriminatorFieldValue]
      if (!_.isPlainObject(discriminatorObject)) {
        log.warn(`Received unexpected value in field ${discriminatorFieldValue}`)
        return instance
      }
      _.assign(instance.value, discriminatorObject)
      delete instance.value[discriminatorFieldValue]
      return instance
    }
  )
