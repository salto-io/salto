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
  InstanceElement, isInstanceElement, isObjectType, ObjectType, ReferenceExpression, Values,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { apiName, isCustomObject, isInstanceOfCustomObject } from '../transformers/transformer'
import { LABEL } from '../constants'
import { getNamespace } from './utils'

const log = logger(module)
const { awu, groupByAsync, keyByAsync } = collections.asynciterable
const { isDefined } = values

const FIELD_DEPENDENCY = 'fieldDependency'
const CONTROLLING_FIELD = 'controllingField'


type FieldDependency = {
    [CONTROLLING_FIELD]: string
}

type ReferencedFieldDef = {
  field: Field
  controllingFieldName: string
}

type FieldWithFieldDependency = Field & {
  annotations: Values & {
    [FIELD_DEPENDENCY]: FieldDependency
  }
}

const FIELD_DEPENDENCY_SCHEMA = Joi.object({
  controllingField: Joi.string().required(),
}).unknown(true).required()

const isFieldDependency = createSchemeGuard<FieldDependency>(FIELD_DEPENDENCY_SCHEMA)

const isFieldWithFieldDependency = (field: Field): field is FieldWithFieldDependency => (
  isFieldDependency(field.annotations[FIELD_DEPENDENCY])
)


const getReferencedFieldDefs = (customObject: ObjectType): ReferencedFieldDef[] => (
  Object.values(customObject.fields)
    .filter(isFieldWithFieldDependency)
    .map(field => ({
      field,
      controllingFieldName: field.annotations[FIELD_DEPENDENCY]?.controllingField,
    }))
)

const getLabel = async (customObject: ObjectType): Promise<string> => {
  const namespace = await getNamespace(customObject)
  const label = customObject.annotations[LABEL]
  return isDefined(namespace)
    ? `${namespace}.${label}`
    : label
}

const getReferencedObjectLabel = (
  instance: InstanceElement,
  fieldDef: ReferencedFieldDef,
  instanceTypeName: string,
  namespace?: string
): string | undefined => {
  const label = instance.value[fieldDef.controllingFieldName]
  if (_.isUndefined(label)) {
    log.warn('Could not find field %s in instance %s', fieldDef.controllingFieldName, instanceTypeName)
    return undefined
  }
  return isDefined(namespace)
    ? `${namespace}.${label}`
    : label
}

const getReferencedFieldLabel = (
  instance: InstanceElement,
  fieldDef: ReferencedFieldDef,
  instanceTypeName: string,
): string | undefined => {
  const label = instance.value[fieldDef.field.name]
  if (_.isUndefined(label)) {
    log.warn('Could not find field %s on type %s from instance %s', fieldDef.controllingFieldName, instanceTypeName, instance.elemID.name)
  }
  return label
}

const setReference = (
  instance: InstanceElement,
  labelToObjectType: Record<string, ObjectType>,
  fieldDef: ReferencedFieldDef,
  instanceTypeName: string,
  instanceNamespace?: string
): void => {
  const referencedObjectLabel = getReferencedObjectLabel(instance, fieldDef, instanceTypeName, instanceNamespace)
  const referencedFieldLabel = getReferencedFieldLabel(instance, fieldDef, instanceTypeName)
  if (_.isUndefined(referencedObjectLabel)) {
    return
  }
  const referencedObject = labelToObjectType[referencedObjectLabel]
  if (_.isUndefined(referencedObject)) {
    log.warn('Could not find referenced object with label %s from instance %s.', referencedObjectLabel, instance.elemID.name)
    return
  }
  instance.value[fieldDef.controllingFieldName] = new ReferenceExpression(referencedObject.elemID)
  if (_.isUndefined(referencedFieldLabel)) {
    return
  }
  const referencedField = Object.values(referencedObject.fields)
    .find(field => field.annotations[LABEL] === referencedFieldLabel)
  if (_.isUndefined(referencedField)) {
    log.warn('Could not find referenced field with label %s in type %s from instance %s.', referencedFieldLabel, instanceTypeName, instance.elemID.name)
    return
  }
  instance.value[fieldDef.field.name] = new ReferenceExpression(referencedField.elemID)
}

const setReferences = async (
  instance: InstanceElement,
  labelToObjectType: Record<string, ObjectType>,
  objectNameToFieldDefs: Record<string, ReferencedFieldDef[]>,
): Promise<void> => {
  const instanceType = await instance.getType()
  const instanceTypeName = await apiName(instanceType)
  const fieldDefs = objectNameToFieldDefs[instanceTypeName]
  if (_.isEmpty(fieldDefs)) {
    log.warn('No referenced field defs found for type %s', instanceTypeName)
  }
  const instanceNamespace = await getNamespace(instanceType)
  fieldDefs.forEach(fieldDef => setReference(
    instance,
    labelToObjectType,
    fieldDef,
    instanceTypeName,
    instanceNamespace
  ))
}

const filter: LocalFilterCreator = () => {
  let originalChanges: Record<string, Change<InstanceElement>>
  return {
    onFetch: async (elements: Element[]) => {
      const customObjects = await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .toArray()
      const referencedFieldDefs = customObjects.flatMap(getReferencedFieldDefs)
      const objectNameToFieldDefs = await groupByAsync(referencedFieldDefs, async def => apiName(def.field.parent))
      const relevantCustomObjects = await awu(customObjects)
        .filter(async customObject => isDefined(objectNameToFieldDefs[await apiName(customObject)]))
        .toArray()
      const relevantInstances = await awu(elements)
        .filter(isInstanceElement)
        .filter(isInstanceOfCustomObject)
        .filter(async instance => relevantCustomObjects.includes(await instance.getType()))
        .toArray()
      if (_.isEmpty(relevantInstances)) {
        return
      }
      // The key here also contains the namespace of the instance, to prefer the object from the namespace.
      // In case of duplication of labels between the installed package and Salesforce/another package we will
      // always prefer the object within the namespace.
      const labelToObjectType = await keyByAsync(customObjects, getLabel)
      await awu(relevantInstances).forEach(instance => setReferences(
        instance,
        labelToObjectType,
        objectNameToFieldDefs
      ))
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
