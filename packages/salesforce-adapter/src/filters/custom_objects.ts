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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  ADAPTER, Element, Field, ObjectType, ServiceIds, TypeElement, isObjectType,
  isInstanceElement, ElemID, BuiltinTypes, CORE_ANNOTATIONS, TypeMap, InstanceElement,
  Values, INSTANCE_ANNOTATIONS, ReferenceExpression, ListType, FieldDefinition,
} from '@salto-io/adapter-api'
import {
  findObjectType,
  naclCase, transformValues,
} from '@salto-io/adapter-utils'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField } from 'jsforce'
import _ from 'lodash'
import {
  API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE, INSTANCE_FULL_NAME_FIELD,
  LABEL, FIELD_DEPENDENCY_FIELDS, LOOKUP_FILTER_FIELDS,
  VALUE_SETTINGS_FIELDS, API_NAME_SEPERATOR, FIELD_ANNOTATIONS, VALUE_SET_DEFINITION_FIELDS,
  VALUE_SET_FIELDS, DEFAULT_VALUE_FORMULA, FIELD_TYPE_NAMES, OBJECTS_PATH, INSTALLED_PACKAGES_PATH,
  FORMULA, LEAD_CONVERT_SETTINGS_METADATA_TYPE, ASSIGNMENT_RULES_METADATA_TYPE,
  WORKFLOW_METADATA_TYPE, QUICK_ACTION_METADATA_TYPE, CUSTOM_TAB_METADATA_TYPE,
  DUPLICATE_RULE_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, SHARING_RULES_TYPE,
  VALIDATION_RULES_METADATA_TYPE, BUSINESS_PROCESS_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  getSObjectFieldElement, Types, isCustomObject, apiName, transformPrimitive,
  formulaTypeName, metadataType, isCustom, relativeApiName,
} from '../transformers/transformer'
import {
  id, addApiName, addMetadataType, addLabel, getNamespace, boolValue,
  buildAnnotationsObjectType, generateApiNameToCustomObject, addObjectParentReference, apiNameParts,
  parentApiName,
  getNamespaceFromString,
} from './utils'
import { convertList } from './convert_lists'
import { WORKFLOW_FIELD_TO_TYPE } from './workflow'

const log = logger(module)
const { makeArray } = collections.array

export const INSTANCE_REQUIRED_FIELD = 'required'
export const INSTANCE_TYPE_FIELD = 'type'

export const NESTED_INSTANCE_VALUE_NAME = {
  WEB_LINKS: 'webLinks',
  VALIDATION_RULES: 'validationRules',
  BUSINESS_PROCESSES: 'businessProcesses',
  RECORD_TYPES: 'recordTypes',
  LIST_VIEWS: 'listViews',
  FIELD_SETS: 'fieldSets',
  COMPACT_LAYOUTS: 'compactLayouts',
  SHARING_REASONS: 'sharingReasons',
  INDEXES: 'indexes',
}

export const NESTED_INSTANCE_TYPE_NAME = {
  WEB_LINK: 'WebLink',
  VALIDATION_RULE: VALIDATION_RULES_METADATA_TYPE,
  BUSINESS_PROCESS: BUSINESS_PROCESS_METADATA_TYPE,
  RECORD_TYPE: RECORD_TYPE_METADATA_TYPE,
  LIST_VIEW: 'ListView',
  FIELD_SET: 'FieldSet',
  COMPACT_LAYOUT: 'CompactLayout',
  SHARING_REASON: 'SharingReason',
  INDEX: 'Index',
}

// The below metadata types extend Metadata and are mutable using a specific API call
export const NESTED_INSTANCE_VALUE_TO_TYPE_NAME = {
  [NESTED_INSTANCE_VALUE_NAME.WEB_LINKS]: NESTED_INSTANCE_TYPE_NAME.WEB_LINK,
  [NESTED_INSTANCE_VALUE_NAME.VALIDATION_RULES]: NESTED_INSTANCE_TYPE_NAME.VALIDATION_RULE,
  [NESTED_INSTANCE_VALUE_NAME.BUSINESS_PROCESSES]: NESTED_INSTANCE_TYPE_NAME.BUSINESS_PROCESS,
  [NESTED_INSTANCE_VALUE_NAME.RECORD_TYPES]: NESTED_INSTANCE_TYPE_NAME.RECORD_TYPE,
  [NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS]: NESTED_INSTANCE_TYPE_NAME.LIST_VIEW,
  [NESTED_INSTANCE_VALUE_NAME.FIELD_SETS]: NESTED_INSTANCE_TYPE_NAME.FIELD_SET,
  [NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS]: NESTED_INSTANCE_TYPE_NAME.COMPACT_LAYOUT,
  [NESTED_INSTANCE_VALUE_NAME.SHARING_REASONS]: NESTED_INSTANCE_TYPE_NAME.SHARING_REASON,
  [NESTED_INSTANCE_VALUE_NAME.INDEXES]: NESTED_INSTANCE_TYPE_NAME.INDEX,
}

type TypesFromInstance = {
  standardAnnotationTypes: TypeMap
  customAnnotationTypes: TypeMap
  nestedMetadataTypes: Record<string, ObjectType>
}

export const CUSTOM_OBJECT_TYPE_ID = new ElemID(SALESFORCE, CUSTOM_OBJECT)

const CUSTOM_ONLY_ANNOTATION_TYPE_NAMES = ['allowInChatterGroups', 'customHelp', 'customHelpPage',
  'customSettingsType', 'deploymentStatus', 'deprecated', 'enableActivities', 'enableBulkApi',
  'enableReports', 'enableSearch', 'enableSharing', 'enableStreamingApi', 'gender',
  'nameField', 'pluralLabel', 'sharingModel', 'startsWith', 'visibility']

const ANNOTATIONS_TO_IGNORE_FROM_INSTANCE = ['eventType', 'publishBehavior', 'fields',
  INSTANCE_FULL_NAME_FIELD, LABEL, 'household', 'articleTypeChannelDisplay']

const getFieldName = (annotations: Values): string =>
  (annotations[FORMULA]
    ? formulaTypeName(annotations[INSTANCE_TYPE_FIELD] as FIELD_TYPE_NAMES)
    : annotations[INSTANCE_TYPE_FIELD])

const getFieldType = (type: string): TypeElement =>
  (_.isUndefined(type) ? BuiltinTypes.STRING : Types.get(type))

export const annotationsFileName = (objectName: string): string => `${objectName}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${objectName}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${objectName}CustomFields`

const getObjectDirectoryPath = (obj: ObjectType, namespace?: string): string[] => {
  if (namespace) {
    return [SALESFORCE, INSTALLED_PACKAGES_PATH, namespace, OBJECTS_PATH, obj.elemID.name]
  }
  return [SALESFORCE, OBJECTS_PATH, obj.elemID.name]
}

type FieldDefinitionWithName = FieldDefinition & { name: string }
const createCustomFieldsObjects = (customFields: FieldDefinitionWithName[], objectName: string,
  serviceIds: ServiceIds, objNamespace?: string): ObjectType[] => {
  const createObjectWithFields = (
    fields: FieldDefinitionWithName[], namespace?: string
  ): ObjectType => {
    const obj = Types.get(objectName, true, false, serviceIds) as ObjectType
    fields.forEach(({ name, type, annotations }) => {
      obj.fields[name] = new Field(obj, name, type, annotations)
    })
    obj.path = [...getObjectDirectoryPath(obj, namespace), customFieldsFileName(obj.elemID.name)]
    return obj
  }

  if (!_.isUndefined(objNamespace) && !_.isEmpty(customFields)) {
    // When having an object with namespace, all of its custom fields go to the same object
    return [createObjectWithFields(customFields, objNamespace)]
  }
  const getFieldDefNamespace = (f: FieldDefinition): string | undefined => (
    getNamespaceFromString(relativeApiName(f.annotations?.[API_NAME] ?? ''))
  )
  const [packagedFields, regularCustomFields] = _.partition(
    customFields, f => getFieldDefNamespace(f) !== undefined
  )
  const namespaceToFields = _.groupBy(packagedFields, f => getFieldDefNamespace(f))
  // Custom fields that belong to a package go in a separate element
  const customFieldsObjects = Object.entries(namespaceToFields)
    .map(([namespace, packageFields]) => createObjectWithFields(packageFields, namespace))

  if (!_.isEmpty(regularCustomFields)) {
    // Custom fields that has no namespace go in a separate element
    const customPart = createObjectWithFields(regularCustomFields)
    customFieldsObjects.push(customPart)
  }
  return customFieldsObjects
}

const createSObjectTypesWithFields = (
  objectName: string,
  fields: SObjField[],
  serviceIds: ServiceIds,
  namespace?: string,
): ObjectType[] => {
  // Filter out nested fields of compound fields
  const filteredFields = fields.filter(field => !field.compoundFieldName)

  const standardFieldsElement = Types.get(objectName, true, false, serviceIds) as ObjectType
  filteredFields
    .filter(f => !f.custom)
    .map(f => getSObjectFieldElement(standardFieldsElement, f, serviceIds))
    .forEach(field => {
      standardFieldsElement.fields[field.name] = field
    })
  standardFieldsElement.path = [...getObjectDirectoryPath(standardFieldsElement, namespace),
    standardFieldsFileName(standardFieldsElement.elemID.name)]

  // Create custom fields (if any)
  const customFields = filteredFields
    .filter(f => f.custom)
    .map(f => getSObjectFieldElement(standardFieldsElement, f, serviceIds))
  return [standardFieldsElement,
    ...createCustomFieldsObjects(customFields, objectName, serviceIds, namespace)]
}

const getFieldDependency = (values: Values): Values | undefined => {
  const controllingField = values[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
  const valueSettingsInfo = values[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]
  if (controllingField && valueSettingsInfo) {
    const valueSettings = makeArray(valueSettingsInfo)
      .map(value => ({
        [VALUE_SETTINGS_FIELDS.VALUE_NAME]: value[VALUE_SETTINGS_FIELDS.VALUE_NAME],
        [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]:
          makeArray(value[VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]),
      }))
    return {
      [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: controllingField,
      [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: valueSettings,
    }
  }
  return undefined
}

const transfromAnnotationsNames = (fields: Values, parentName: string): Values => {
  const annotations: Values = {}
  const typeName = fields[INSTANCE_TYPE_FIELD]
  Object.entries(fields).forEach(([k, v]) => {
    switch (k) {
      case INSTANCE_REQUIRED_FIELD:
        annotations[CORE_ANNOTATIONS.REQUIRED] = v
        break
      case INSTANCE_FULL_NAME_FIELD:
        annotations[API_NAME] = [parentName, v].join(API_NAME_SEPERATOR)
        break
      case FIELD_ANNOTATIONS.DEFAULT_VALUE:
        if (typeName === FIELD_TYPE_NAMES.CHECKBOX) {
          annotations[k] = v
        } else {
          annotations[DEFAULT_VALUE_FORMULA] = v
        }
        break
      case FIELD_ANNOTATIONS.VALUE_SET:
        // Checks for global value set
        if (!_.isUndefined(v[VALUE_SET_FIELDS.VALUE_SET_NAME])) {
          annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = v[VALUE_SET_FIELDS.VALUE_SET_NAME]
          annotations[FIELD_ANNOTATIONS.RESTRICTED] = true
        } else {
          const valueSetDefinition = v[VALUE_SET_FIELDS.VALUE_SET_DEFINITION]
          if (valueSetDefinition) {
            annotations[FIELD_ANNOTATIONS.VALUE_SET] = valueSetDefinition[
              VALUE_SET_DEFINITION_FIELDS.VALUE
            ]
            annotations[VALUE_SET_DEFINITION_FIELDS.SORTED] = valueSetDefinition[
              VALUE_SET_DEFINITION_FIELDS.SORTED
            ] || false
            annotations[FIELD_ANNOTATIONS.RESTRICTED] = v[VALUE_SET_FIELDS.RESTRICTED] || false
          }
        }
        if (!_.isUndefined(getFieldDependency(v))) {
          annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = getFieldDependency(v)
        }
        break
      case FIELD_ANNOTATIONS.LOOKUP_FILTER:
        if (boolValue(v[LOOKUP_FILTER_FIELDS.IS_OPTIONAL])) {
          delete v[LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]
        }
        annotations[k] = v
        break
      case FIELD_ANNOTATIONS.REFERENCE_TO:
        annotations[k] = makeArray(v)
        break
      case FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS:
        annotations[k] = makeArray(v)
        break
      default:
        annotations[k] = v
    }
  })
  return annotations
}

export const transformFieldAnnotations = (
  instanceFieldValues: Values,
  parentName: string
): Values => {
  // Ignores typeless/unknown typed instances
  if (!_.has(instanceFieldValues, INSTANCE_TYPE_FIELD)) {
    return {}
  }

  const fieldType = Types.getKnownType(getFieldName(instanceFieldValues), true)
  if (_.isUndefined(fieldType)) {
    return {}
  }

  const annotations = transfromAnnotationsNames(instanceFieldValues, parentName)
  const annotationsType = buildAnnotationsObjectType(fieldType.annotationTypes)
  convertList(annotationsType, annotations)

  return transformValues(
    {
      values: annotations,
      type: annotationsType,
      transformFunc: transformPrimitive,
    }
  ) || {}
}

const transformObjectAnnotationValues = (instance: InstanceElement,
  annotationTypesFromInstance: TypeMap):
  Values | undefined => {
  const annotationsObject = buildAnnotationsObjectType(annotationTypesFromInstance)
  return transformValues(
    {
      values: instance.value,
      type: annotationsObject,
      transformFunc: transformPrimitive,
    }
  )
}

const transformObjectAnnotations = (customObject: ObjectType, annotationTypesFromInstance: TypeMap,
  instance: InstanceElement): void => {
  Object.assign(customObject.annotationTypes, annotationTypesFromInstance)

  Object.assign(customObject.annotations,
    transformObjectAnnotationValues(instance, annotationTypesFromInstance))
}

const mergeCustomObjectWithInstance = (
  customObject: ObjectType, fieldNameToFieldAnnotations: Record<string, Values>,
  instance: InstanceElement, annotationTypesFromInstance: TypeMap
): void => {
  _(customObject.fields).forEach(field => {
    Object.assign(field.annotations, transformFieldAnnotations(
      fieldNameToFieldAnnotations[apiName(field, true)] || {},
      apiName(instance)
    ))
    if (field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
      && field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]) {
      delete field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
    }
  })
  if (customObject.annotations[API_NAME]) {
    // assigning annotations only to the "AnnotationsObjectType"
    transformObjectAnnotations(customObject, annotationTypesFromInstance, instance)
  }
}

const createObjectTypeWithBaseAnnotations = (name: string, label: string):
  { serviceIds: ServiceIds; object: ObjectType; namespace?: string } => {
  const serviceIds = {
    [ADAPTER]: SALESFORCE,
    [API_NAME]: name,
    [METADATA_TYPE]: CUSTOM_OBJECT,
  }
  const object = Types.get(name, true, false, serviceIds) as ObjectType
  addApiName(object, name)
  addMetadataType(object)
  addLabel(object, label)
  const namespace = getNamespace(object)
  object.path = [...getObjectDirectoryPath(object, namespace),
    annotationsFileName(object.elemID.name)]
  return { serviceIds, object, namespace }
}

const createNestedMetadataInstances = (instance: InstanceElement,
  { elemID: objElemID, path: objPath }: ObjectType,
  nestedMetadataTypes: Record<string, ObjectType>):
  InstanceElement[] =>
  _.flatten(Object.entries(nestedMetadataTypes)
    .map(([name, type]) => {
      const nestedInstances = makeArray(instance.value[name])
      if (_.isEmpty(nestedInstances)) {
        return []
      }
      const removeDuplicateInstances = (instances: Values[]): Values[] => (
        _(instances).keyBy(INSTANCE_FULL_NAME_FIELD).values().value()
      )
      return removeDuplicateInstances(nestedInstances).map(nestedInstance => {
        const fullName = [apiName(instance), nestedInstance[INSTANCE_FULL_NAME_FIELD]]
          .join(API_NAME_SEPERATOR)
        const elemIdName = naclCase(fullName)
        nestedInstance[INSTANCE_FULL_NAME_FIELD] = fullName
        return new InstanceElement(elemIdName, type, nestedInstance,
          [...(objPath as string[]).slice(0, -1), type.elemID.name, elemIdName],
          { [INSTANCE_ANNOTATIONS.PARENT]: new ReferenceExpression(objElemID) })
      })
    }))

const createFromInstance = (instance: InstanceElement,
  typesFromInstance: TypesFromInstance): Element[] => {
  const createFieldsFromInstanceFields = (
    instanceFields: Values, objectName: string,
  ): FieldDefinitionWithName[] =>
    instanceFields
      .map((field: Values) => {
        const fieldFullName = naclCase(field[INSTANCE_FULL_NAME_FIELD])
        return {
          name: fieldFullName,
          type: getFieldType(getFieldName(field)),
          annotations: transformFieldAnnotations(field, objectName),
        }
      })

  const objectName = instance.value[INSTANCE_FULL_NAME_FIELD]
  const newElements: Element[] = []
  const { serviceIds, object: annotationsObject, namespace } = createObjectTypeWithBaseAnnotations(
    objectName, instance.value[LABEL]
  )
  transformObjectAnnotations(annotationsObject, isCustom(objectName)
    ? typesFromInstance.customAnnotationTypes
    : typesFromInstance.standardAnnotationTypes, instance)
  newElements.push(annotationsObject)

  const instanceFields = makeArray(instance.value.fields)
  const [instanceCustomFields, instanceStandardFields] = _.partition(instanceFields, field =>
    isCustom(field[INSTANCE_FULL_NAME_FIELD]))
  if (!_.isEmpty(instanceStandardFields)) {
    const standardFieldsElement = Types.get(objectName, true, false, serviceIds) as ObjectType
    const standardFields = createFieldsFromInstanceFields(instanceStandardFields, objectName)
    standardFields
      .forEach(({ name, type, annotations }) => {
        standardFieldsElement.fields[name] = new Field(
          standardFieldsElement, name, type, annotations,
        )
      })
    standardFieldsElement.path = [...getObjectDirectoryPath(standardFieldsElement, namespace),
      standardFieldsFileName(standardFieldsElement.elemID.name)]
    newElements.push(standardFieldsElement)
  }
  const customFields = createFieldsFromInstanceFields(instanceCustomFields, objectName)
  newElements.push(...createCustomFieldsObjects(customFields, objectName, serviceIds, namespace))
  const nestedMetadataInstances = createNestedMetadataInstances(instance, annotationsObject,
    typesFromInstance.nestedMetadataTypes)
  newElements.push(...nestedMetadataInstances)
  return newElements
}

const fetchSObjects = async (client: SalesforceClient):
  Promise<Record<string, DescribeSObjectResult[]>> => {
  const getSobjectDescriptions = async (): Promise<DescribeSObjectResult[]> => {
    const sobjectsList = await client.listSObjects()
    const sobjectNames = sobjectsList.map(sobj => sobj.name)
    return client.describeSObjects(sobjectNames)
  }

  const getCustomObjectNames = async (): Promise<Set<string>> => {
    const { result: customObjects } = await client.listMetadataObjects(
      { type: CUSTOM_OBJECT },
      // All errors are considered to be unhandled errors. If an error occur, throws an exception
      () => true
    )
    return new Set(customObjects.map(o => o.fullName))
  }

  const [customObjectNames, sobjectsDescriptions] = await Promise.all([
    getCustomObjectNames(), getSobjectDescriptions(),
  ])

  return _(sobjectsDescriptions)
    .filter(({ name }) => customObjectNames.has(name))
    .groupBy(e => e.name)
    .value()
}

const createFromSObjectsAndInstances = (
  sObjects: DescribeSObjectResult[],
  instances: Record<string, InstanceElement>,
  typesFromInstance: TypesFromInstance
): Element[] =>
  _.flatten(sObjects.map(({ name, label, custom, fields }) => {
    const { serviceIds, object, namespace } = createObjectTypeWithBaseAnnotations(name, label)
    const objects = [object, ...createSObjectTypesWithFields(name, fields, serviceIds, namespace)]
    const instance = instances[name]
    if (!instance) {
      return objects
    }
    const fieldNameToFieldAnnotations = _(makeArray(instance.value.fields))
      .map(field => [field[INSTANCE_FULL_NAME_FIELD], field])
      .fromPairs()
      .value()
    objects.forEach(obj => mergeCustomObjectWithInstance(
      obj, fieldNameToFieldAnnotations, instance, custom
        ? typesFromInstance.customAnnotationTypes
        : typesFromInstance.standardAnnotationTypes
    ))
    return [...objects, ...createNestedMetadataInstances(instance, object,
      typesFromInstance.nestedMetadataTypes)]
  }))

const removeIrrelevantElements = (elements: Element[]): void => {
  _.remove(elements, elem => (isCustomObject(elem) && isInstanceElement(elem)))
  _.remove(elements, elem => elem.elemID.isEqual(CUSTOM_OBJECT_TYPE_ID))
  // We currently don't support platform event and article type objects (SALTO-530, SALTO-531)
  _.remove(elements, elem => (isObjectType(elem) && isCustomObject(elem) && apiName(elem)
    && (apiName(elem).endsWith('__e') || apiName(elem).endsWith('__kav'))))
  _.remove(elements, elem => (isObjectType(elem)
    && ['ArticleTypeChannelDisplay', 'ArticleTypeTemplate'].includes(metadataType(elem))))
}

// Instances metadataTypes that should be under the customObject folder and have a PARENT reference
const workflowDependentMetadataTypes = new Set([WORKFLOW_METADATA_TYPE,
  ...Object.values(WORKFLOW_FIELD_TO_TYPE)])
const dependentMetadataTypes = new Set([CUSTOM_TAB_METADATA_TYPE, DUPLICATE_RULE_METADATA_TYPE,
  QUICK_ACTION_METADATA_TYPE, WORKFLOW_METADATA_TYPE, LEAD_CONVERT_SETTINGS_METADATA_TYPE,
  ASSIGNMENT_RULES_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, SHARING_RULES_TYPE,
  ...workflowDependentMetadataTypes.values(),
])

const hasCustomObjectParent = (instance: InstanceElement): boolean =>
  dependentMetadataTypes.has(metadataType(instance))

const fixDependentInstancesPathAndSetParent = (elements: Element[]): void => {
  const setDependingInstancePath = (instance: InstanceElement, customObject: ObjectType):
    void => {
    if (customObject.path) {
      instance.path = [
        ...customObject.path.slice(0, -1),
        ...(workflowDependentMetadataTypes.has(instance.elemID.typeName)
          ? [WORKFLOW_METADATA_TYPE, instance.elemID.typeName] : [instance.elemID.typeName]),
        ...(apiNameParts(instance).length > 1 ? [instance.elemID.name] : []),
      ]
    }
  }

  const apiNameToCustomObject = generateApiNameToCustomObject(elements)

  const getDependentCustomObj = (instance: InstanceElement): ObjectType | undefined => {
    const customObject = apiNameToCustomObject.get(parentApiName(instance))
    if (_.isUndefined(customObject)
      && metadataType(instance) === LEAD_CONVERT_SETTINGS_METADATA_TYPE) {
      return apiNameToCustomObject.get('Lead')
    }
    return customObject
  }

  elements
    .filter(isInstanceElement)
    .filter(hasCustomObjectParent)
    .forEach(instance => {
      const customObj = getDependentCustomObj(instance)
      if (_.isUndefined(customObj)) {
        return
      }
      setDependingInstancePath(instance, customObj)
      addObjectParentReference(instance, customObj)
    })
}

/**
 * Custom objects filter.
 * Fetches the custom objects via the soap api and adds them to the elements
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const sObjects = await fetchSObjects(client).catch(e => {
      log.error('failed to fetch sobjects reason: %o', e)
      return []
    })

    const customObjectInstances = _(elements)
      .filter(isCustomObject)
      .filter(isInstanceElement)
      .map(instance => [apiName(instance), instance])
      .fromPairs()
      .value()

    const typesToMergeFromInstance = (): TypesFromInstance => {
      const fixTypesDefinitions = (typesFromInstance: TypeMap): void => {
        const listViewType = typesFromInstance[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS] as ObjectType
        listViewType.fields.columns.type = new ListType(listViewType.fields.columns.type)
        listViewType.fields.filters.type = new ListType(listViewType.fields.filters.type)
        const fieldSetType = typesFromInstance[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS] as ObjectType
        fieldSetType.fields.availableFields.type = new ListType(
          fieldSetType.fields.availableFields.type
        )
        fieldSetType.fields.displayedFields.type = new ListType(
          fieldSetType.fields.displayedFields.type
        )
        const compactLayoutType = typesFromInstance[NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS] as
          ObjectType
        compactLayoutType.fields.fields.type = new ListType(compactLayoutType.fields.fields.type)
      }

      const getAllTypesFromInstance = (): TypeMap => {
        const customObjectType = findObjectType(elements, CUSTOM_OBJECT_TYPE_ID)
        if (_.isUndefined(customObjectType)) {
          return {}
        }
        const typesFromInstance: TypeMap = _(customObjectType.fields)
          .entries()
          .filter(([name, _field]) => !ANNOTATIONS_TO_IGNORE_FROM_INSTANCE.includes(name))
          .map(([name, field]) => [name, field.type])
          .fromPairs()
          .value()

        fixTypesDefinitions(typesFromInstance)
        return typesFromInstance
      }

      const typesFromInstance = getAllTypesFromInstance()
      const nestedMetadataTypes = _.pick(typesFromInstance,
        Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME)) as Record<string, ObjectType>
      const customOnlyAnnotationTypes = _.pick(typesFromInstance,
        CUSTOM_ONLY_ANNOTATION_TYPE_NAMES)
      const standardAnnotationTypes = _.omit(typesFromInstance,
        Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME), CUSTOM_ONLY_ANNOTATION_TYPE_NAMES)
      return {
        standardAnnotationTypes,
        customAnnotationTypes: { ...standardAnnotationTypes, ...customOnlyAnnotationTypes },
        nestedMetadataTypes,
      }
    }

    const typesFromInstance = typesToMergeFromInstance()
    const newElements: Element[] = createFromSObjectsAndInstances(
      _.flatten(Object.values(sObjects)),
      customObjectInstances,
      typesFromInstance,
    )

    const objectTypeNames = new Set(Object.keys(sObjects))
    Object.entries(customObjectInstances).forEach(([instanceApiName, instance]) => {
      // Adds objects that exists in the metadata api but don't exist in the soap api
      if (!objectTypeNames.has(instanceApiName)) {
        newElements.push(...createFromInstance(instance, typesFromInstance))
      }
    })

    removeIrrelevantElements(elements)
    const elementFullNames = new Set(elements.map(elem => id(elem)))
    newElements
      .filter(newElem => !elementFullNames.has(id(newElem)))
      .forEach(newElem => elements.push(newElem))

    fixDependentInstancesPathAndSetParent(elements)
  },
})

export default filterCreator
