import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import {
  ADAPTER, Element, Field, ObjectType, ServiceIds, TypeElement, isObjectType, InstanceElement,
  isInstanceElement, ElemID, BuiltinTypes, CORE_ANNOTATIONS, transform, TypeMap, getChangeElement,
  Value, findObjectType, Change, Values,
} from 'adapter-api'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField, SaveResult, UpsertResult } from 'jsforce'
import _ from 'lodash'
import {
  API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE, INSTANCE_FULL_NAME_FIELD,
  SALESFORCE_CUSTOM_SUFFIX, LABEL, FIELD_DEPENDENCY_FIELDS, LOOKUP_FILTER_FIELDS,
  VALUE_SETTINGS_FIELDS, API_NAME_SEPERATOR, FIELD_ANNOTATIONS, VALUE_SET_DEFINITION_FIELDS,
  CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS, VALUE_SET_FIELDS, DEFAULT_VALUE_FORMULA, FIELD_TYPE_NAMES,
  OBJECTS_PATH, INSTALLED_PACKAGES_PATH, FORMULA,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  getSObjectFieldElement, Types, isCustomObject, bpCase, apiName, transformPrimitive,
  toMetadataInfo, formulaTypeName, metadataType,
} from '../transformers/transformer'
import { id, addApiName, addMetadataType, addLabel, hasNamespace,
  getNamespace, boolValue, buildAnnotationsObjectType } from './utils'
import { convertList } from './convert_lists'

const log = logger(module)
const { makeArray } = collections.array

export const INSTANCE_REQUIRED_FIELD = 'required'
export const INSTANCE_TYPE_FIELD = 'type'

// The below annotationTypes extend Metadata and are mutable using a specific API call
// (they are not updated when updating the custom object)
export const customObjectIndependentAnnotations = {
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.WEB_LINKS]: 'WebLink',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.VALIDATION_RULES]: 'ValidationRule',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.BUSINESS_PROCESSES]: 'BusinessProcess',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.RECORD_TYPES]: 'RecordType',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.LIST_VIEWS]: 'ListView',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.FIELD_SETS]: 'FieldSet',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.COMPACT_LAYOUTS]: 'CompactLayout',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.SHARING_REASONS]: 'SharingReason',
  [CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS.INDEXES]: 'Index',
}

type AnnotationTypesFromInstance = {
  standardAnnotationTypes: TypeMap
  customAnnotationTypes: TypeMap
  independentAnnotationTypes: TypeMap
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

const createObjectWithFields = (objectName: string, serviceIds: ServiceIds,
  fields: Field[]): ObjectType => {
  const obj = Types.get(objectName, true, false, serviceIds) as ObjectType
  fields.forEach(field => {
    obj.fields[field.name] = field
  })
  return obj
}

export const annotationsFileName = (objectName: string): string => `${objectName}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${objectName}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${objectName}CustomFields`

const getObjectDirectoryPath = (obj: ObjectType, namespace?: string): string[] => {
  if (namespace) {
    return [SALESFORCE, INSTALLED_PACKAGES_PATH, namespace, OBJECTS_PATH, obj.elemID.name]
  }
  return [SALESFORCE, OBJECTS_PATH, obj.elemID.name]
}

const createCustomFieldsObjects = (customFields: Field[], objectName: string,
  serviceIds: ServiceIds, objNamespace?: string): ObjectType[] => {
  const [packagedFields, regularCustomFields] = _.partition(customFields, f => hasNamespace(f))
  const namespaceToFields: Record<string, Field[]> = _.groupBy(packagedFields, f => getNamespace(f))
  // Custom fields that belong to a package go in a separate element
  const customFieldsObjects = Object.entries(namespaceToFields)
    .map(([namespace, packageFields]) => {
      const packageObj = createObjectWithFields(objectName, serviceIds, packageFields)
      packageObj.path = [...getObjectDirectoryPath(packageObj, namespace),
        customFieldsFileName(packageObj.elemID.name)]
      return packageObj
    })
  if (!_.isEmpty(regularCustomFields)) {
    // Custom fields go in a separate element
    const customPart = createObjectWithFields(objectName, serviceIds, regularCustomFields)
    customPart.path = [...getObjectDirectoryPath(customPart, objNamespace),
      customFieldsFileName(customPart.elemID.name)]
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
    .map(f => getSObjectFieldElement(standardFieldsElement.elemID, f, serviceIds))
    .forEach(field => {
      standardFieldsElement.fields[field.name] = field
    })
  standardFieldsElement.path = [...getObjectDirectoryPath(standardFieldsElement, namespace),
    standardFieldsFileName(standardFieldsElement.elemID.name)]

  // Create custom fields (if any)
  const customFields = filteredFields
    .filter(f => f.custom)
    .map(f => getSObjectFieldElement(standardFieldsElement.elemID, f, serviceIds))
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

const transfromAnnotationsNames = (fields: Values, parentApiName: string): Values => {
  const annotations: Values = {}
  const typeName = fields[INSTANCE_TYPE_FIELD]
  Object.entries(fields).forEach(([k, v]) => {
    switch (k) {
      case INSTANCE_REQUIRED_FIELD:
        annotations[CORE_ANNOTATIONS.REQUIRED] = v
        break
      case INSTANCE_FULL_NAME_FIELD:
        annotations[API_NAME] = [parentApiName, v].join(API_NAME_SEPERATOR)
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
  parentApiName: string
): Values => {
  // Ignores typeless/unknown typed instances
  if (!_.has(instanceFieldValues, INSTANCE_TYPE_FIELD)) {
    return {}
  }

  const fieldType = Types.getKnownType(getFieldName(instanceFieldValues), true)
  if (_.isUndefined(fieldType)) {
    return {}
  }

  const annotations = transfromAnnotationsNames(instanceFieldValues, parentApiName)
  const annotationsType = buildAnnotationsObjectType(fieldType.annotationTypes)
  convertList(annotationsType, annotations)

  return transform(annotations, annotationsType, transformPrimitive) || {}
}

const transformObjectAnnotationValues = (instance: InstanceElement,
  annotationTypesFromInstance: TypeMap):
  Values | undefined => {
  const annotationsObject = buildAnnotationsObjectType(annotationTypesFromInstance)
  return transform(instance.value, annotationsObject, transformPrimitive)
}

const transformObjectAnnotations = (customObject: ObjectType, annotationTypesFromInstance: TypeMap,
  independentAnnotationTypes: TypeMap, instance: InstanceElement): void => {
  Object.assign(customObject.annotationTypes, annotationTypesFromInstance,
    independentAnnotationTypes)

  Object.assign(customObject.annotations,
    transformObjectAnnotationValues(instance, annotationTypesFromInstance))
}

const mergeCustomObjectWithInstance = (
  customObject: ObjectType, fieldNameToFieldAnnotations: Record<string, Values>,
  instance: InstanceElement, annotationTypesFromInstance: TypeMap,
  independentAnnotationTypesFromInstance: TypeMap
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
    transformObjectAnnotations(customObject, annotationTypesFromInstance,
      independentAnnotationTypesFromInstance, instance)
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
  const namespace = hasNamespace(object) ? getNamespace(object) : undefined
  object.path = [...getObjectDirectoryPath(object, namespace),
    annotationsFileName(object.elemID.name)]
  return { serviceIds, object, namespace }
}

const createIndependentAnnotationObjects = (instance: InstanceElement,
  independentAnnotationTypes: TypeMap, objectName: string, serviceIds: ServiceIds,
  namespace?: string): ObjectType[] => {
  const transformedIndependentAnnotations = transformObjectAnnotationValues(instance,
    independentAnnotationTypes)
  if (_.isUndefined(transformedIndependentAnnotations)) {
    return []
  }

  _(transformedIndependentAnnotations)
    .values()
    .flatten()
    .forEach(annotationInst => {
      annotationInst[INSTANCE_FULL_NAME_FIELD] = [objectName,
        annotationInst[INSTANCE_FULL_NAME_FIELD]].join(API_NAME_SEPERATOR)
    })

  return Object.entries(transformedIndependentAnnotations)
    .map(([annoName, value]) => {
      const independentAnnotationObj = Types.get(objectName, true, false, serviceIds) as ObjectType
      independentAnnotationObj.annotations[annoName] = value
      independentAnnotationObj.path = [
        ...getObjectDirectoryPath(independentAnnotationObj, namespace),
        `${objectName}${annoName[0].toUpperCase()}${annoName.slice(1)}`]
      return independentAnnotationObj
    })
}

const createObjectTypesFromInstance = (instance: InstanceElement,
  annotationTypesFromInstance: AnnotationTypesFromInstance): ObjectType[] => {
  const createFieldsFromInstanceFields = (instanceFields: Values, elemID: ElemID,
    objectName: string): Field[] =>
    instanceFields
      .map((field: Values) => {
        const fieldFullName = bpCase(field[INSTANCE_FULL_NAME_FIELD])
        return new Field(
          elemID,
          fieldFullName,
          getFieldType(getFieldName(field)),
          transformFieldAnnotations(field, objectName)
        )
      })

  const objectName = instance.value[INSTANCE_FULL_NAME_FIELD]
  const objects: ObjectType[] = []
  const { serviceIds, object: annotationsObject, namespace } = createObjectTypeWithBaseAnnotations(
    objectName, instance.value[LABEL]
  )
  transformObjectAnnotations(annotationsObject, objectName.endsWith(SALESFORCE_CUSTOM_SUFFIX)
    ? annotationTypesFromInstance.customAnnotationTypes
    : annotationTypesFromInstance.standardAnnotationTypes,
  annotationTypesFromInstance.independentAnnotationTypes, instance)
  objects.push(annotationsObject)

  const instanceFields = makeArray(instance.value.fields)
  const [instanceCustomFields, instanceStandardFields] = _.partition(instanceFields, field =>
    field[INSTANCE_FULL_NAME_FIELD].endsWith(SALESFORCE_CUSTOM_SUFFIX))
  if (!_.isEmpty(instanceStandardFields)) {
    const standardFieldsElement = Types.get(objectName, true, false, serviceIds) as ObjectType
    const standardFields = createFieldsFromInstanceFields(instanceStandardFields,
      annotationsObject.elemID, objectName)
    standardFields
      .forEach(field => {
        standardFieldsElement.fields[field.name] = field
      })
    standardFieldsElement.path = [...getObjectDirectoryPath(standardFieldsElement, namespace),
      standardFieldsFileName(standardFieldsElement.elemID.name)]
    objects.push(standardFieldsElement)
  }
  const customFields = createFieldsFromInstanceFields(instanceCustomFields,
    annotationsObject.elemID, objectName)
  objects.push(...createCustomFieldsObjects(customFields, objectName, serviceIds, namespace))
  const independentAnnotationObjects = createIndependentAnnotationObjects(instance,
    annotationTypesFromInstance.independentAnnotationTypes, objectName, serviceIds, namespace)
  objects.push(...independentAnnotationObjects)
  return objects
}

const fetchSObjects = async (client: SalesforceClient):
  Promise<Record<string, DescribeSObjectResult[]>> => {
  const getSobjectDescriptions = async (): Promise<DescribeSObjectResult[]> => {
    const sobjectsList = await client.listSObjects()
    const sobjectNames = sobjectsList.map(sobj => sobj.name)
    return client.describeSObjects(sobjectNames)
  }

  const getCustomObjectNames = async (): Promise<Set<string>> => {
    const customObjects = await client.listMetadataObjects({ type: CUSTOM_OBJECT })
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
  annotationTypesFromInstance: AnnotationTypesFromInstance
): ObjectType[] =>
  _.flatten(sObjects.map(({ name, label, custom, fields }) => {
    const { serviceIds, object, namespace } = createObjectTypeWithBaseAnnotations(name, label)
    const objects = [object, ...createSObjectTypesWithFields(name, fields, serviceIds, namespace)]
    const instance = instances[name]
    if (instance) {
      const fieldNameToFieldAnnotations = _(makeArray(instance.value.fields))
        .map(field => [field[INSTANCE_FULL_NAME_FIELD], field])
        .fromPairs()
        .value()
      objects.forEach(obj => mergeCustomObjectWithInstance(
        obj, fieldNameToFieldAnnotations, instance, custom
          ? annotationTypesFromInstance.customAnnotationTypes
          : annotationTypesFromInstance.standardAnnotationTypes,
        annotationTypesFromInstance.independentAnnotationTypes
      ))
      objects.push(...createIndependentAnnotationObjects(instance,
        annotationTypesFromInstance.independentAnnotationTypes, name, serviceIds, namespace))
    }
    return objects
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
// ---

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

    const annotationTypesToMergeFromInstance = (): AnnotationTypesFromInstance => {
      const fixAnnotationTypesDefinitions = (annotationTypesFromInstance: TypeMap): void => {
        const listViewType = annotationTypesFromInstance[CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS
          .LIST_VIEWS] as ObjectType
        listViewType.fields.columns.isList = true
        listViewType.fields.filters.isList = true
        const fieldSetType = annotationTypesFromInstance[CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS
          .FIELD_SETS] as ObjectType
        fieldSetType.fields.availableFields.isList = true
        fieldSetType.fields.displayedFields.isList = true
        const compactLayoutType = annotationTypesFromInstance[CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS
          .COMPACT_LAYOUTS] as ObjectType
        compactLayoutType.fields.fields.isList = true
      }

      const getAllAnnotationTypesFromInstance = (): TypeMap => {
        const customObjectType = findObjectType(elements, CUSTOM_OBJECT_TYPE_ID)
        if (_.isUndefined(customObjectType)) {
          return {}
        }
        const annotationTypesFromInstance: TypeMap = _(customObjectType.fields)
          .entries()
          .filter(([name, _field]) => !ANNOTATIONS_TO_IGNORE_FROM_INSTANCE.includes(name))
          .map(([name, field]) => [name, field.type])
          .fromPairs()
          .value()

        fixAnnotationTypesDefinitions(annotationTypesFromInstance)
        return annotationTypesFromInstance
      }

      const annotationTypesFromInstance = getAllAnnotationTypesFromInstance()
      const independentAnnotationTypes = _.pick(annotationTypesFromInstance,
        Object.keys(customObjectIndependentAnnotations))
      const customOnlyAnnotationTypes = _.pick(annotationTypesFromInstance,
        CUSTOM_ONLY_ANNOTATION_TYPE_NAMES)
      const standardAnnotationTypes = _.omit(annotationTypesFromInstance,
        Object.keys(customObjectIndependentAnnotations), CUSTOM_ONLY_ANNOTATION_TYPE_NAMES)
      return {
        standardAnnotationTypes,
        customAnnotationTypes: { ...standardAnnotationTypes, ...customOnlyAnnotationTypes },
        independentAnnotationTypes,
      }
    }

    const annotationTypesFromInstance = annotationTypesToMergeFromInstance()
    const customObjectTypes = createFromSObjectsAndInstances(
      _.flatten(Object.values(sObjects)),
      customObjectInstances,
      annotationTypesFromInstance,
    )

    const objectTypeNames = new Set(Object.keys(sObjects))
    Object.entries(customObjectInstances).forEach(([instanceApiName, instance]) => {
      // Adds objects that exists in the metadata api but don't exist in the soap api
      if (!objectTypeNames.has(instanceApiName)) {
        customObjectTypes.push(...createObjectTypesFromInstance(instance,
          annotationTypesFromInstance))
      }
    })

    removeIrrelevantElements(elements)
    const objectTypeFullNames = new Set(elements.filter(isObjectType).map(elem => id(elem)))
    customObjectTypes
      .filter(obj => !objectTypeFullNames.has(id(obj)))
      .forEach(elem => elements.push(elem))
  },

  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<(SaveResult| UpsertResult)[]> => {
    if (!(isObjectType(before) && isObjectType(after)
      && changes.some(c => isObjectType(getChangeElement(c))))) {
      return []
    }
    const handleObjectAnnotationChanges = async (annotationName: string, typeName: string):
      Promise<(SaveResult | UpsertResult)[][]> => {
      const getFullNameToAnnotation = (obj: ObjectType): Record<string, Value> =>
        _(makeArray(obj.annotations[annotationName]))
          .map(annotation => [annotation[INSTANCE_FULL_NAME_FIELD], annotation])
          .fromPairs()
          .value()

      const nameToBeforeAnnotation = getFullNameToAnnotation(before)
      const nameToAfterAnnotation = getFullNameToAnnotation(after)
      if (_.isEqual(nameToBeforeAnnotation, nameToAfterAnnotation)) {
        return Promise.resolve([])
      }
      return Promise.all([
        client.upsert(typeName,
          Object.entries(nameToAfterAnnotation)
            .filter(([fullName, _val]) => _.isUndefined(nameToBeforeAnnotation[fullName]))
            .map(([fullName, val]) => toMetadataInfo(fullName, val))),
        client.update(typeName,
          Object.entries(nameToAfterAnnotation)
            .filter(([fullName, val]) => nameToBeforeAnnotation[fullName]
              && !_.isEqual(val, nameToBeforeAnnotation[fullName]))
            .map(([fullName, val]) => toMetadataInfo(fullName, val))),
        client.delete(typeName,
          Object.keys(nameToBeforeAnnotation)
            .filter(fullName => _.isUndefined(nameToAfterAnnotation[fullName]))),
      ])
    }

    return _.flatten(_.flatten((await Promise.all(Object.entries(customObjectIndependentAnnotations)
      .map(([annotationName, typeName]) =>
        handleObjectAnnotationChanges(annotationName, typeName))))))
  },

  onAdd: async (after: Element): Promise<UpsertResult[]> => {
    if (!(isObjectType(after))) {
      return []
    }
    return _.flatten((await Promise.all(Object.entries(customObjectIndependentAnnotations)
      .map(([annotationName, typeName]) =>
        client.upsert(typeName,
          makeArray(after.annotations[annotationName])
            .map(val => toMetadataInfo(val[INSTANCE_FULL_NAME_FIELD], val)))))))
  },
})

export default filterCreator
