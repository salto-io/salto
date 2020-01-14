import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import {
  ADAPTER, Element, Field, ObjectType, ServiceIds, Type, isObjectType, InstanceElement,
  Values, isInstanceElement, ElemID, BuiltinTypes,
  CORE_ANNOTATIONS, BuiltinAnnotationTypes, RESTRICTION_ANNOTATIONS,
  transform, TypeMap, getChangeElement, Value, findObjectType, Change,
} from 'adapter-api'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField, SaveResult, UpsertResult } from 'jsforce'
import _ from 'lodash'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE,
  INSTANCE_FULL_NAME_FIELD, SALESFORCE_CUSTOM_SUFFIX, LABEL, FIELD_DEPENDENCY_FIELDS,
  FIELD_TYPE_API_NAMES, FIELD_ANNOTATIONS, VALUE_SET_FIELDS,
  LOOKUP_FILTER_FIELDS, VALUE_SETTINGS_FIELDS, API_NAME_SEPERATOR,
  VALUE_SET_DEFINITION_FIELDS, DEFAULT_VALUE_FORMULA,
  CUSTOM_OBJECT_ANNOTATIONS, FIELD_TYPE_NAMES } from '../constants'
import { FilterCreator } from '../filter'
import {
  getSObjectFieldElement, Types, isCustomObject, bpCase, apiName, transformPrimitive,
  toMetadataInfo, sfCase,
} from '../transformers/transformer'
import { id, addApiName, addMetadataType, addLabel, hasNamespace,
  getNamespace, boolValue } from './utils'
import { convertList } from './convert_lists'

const log = logger(module)
const { makeArray } = collections.array

export const INSTANCE_REQUIRED_FIELD = 'required'
export const INSTANCE_TYPE_FIELD = 'type'

// The below annotationTypes' data is returned when using ReadMetadata on the CustomObject instances
export const customObjectAnnotationTypeIds = {
  [CUSTOM_OBJECT_ANNOTATIONS.WEB_LINKS]: new ElemID(SALESFORCE, 'web_link'),
  [CUSTOM_OBJECT_ANNOTATIONS.VALIDATION_RULES]: new ElemID(SALESFORCE, 'validation_rule'),
  [CUSTOM_OBJECT_ANNOTATIONS.BUSINESS_PROCESSES]: new ElemID(SALESFORCE, 'business_process'),
  [CUSTOM_OBJECT_ANNOTATIONS.RECORD_TYPES]: new ElemID(SALESFORCE, 'record_type'),
  [CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS]: new ElemID(SALESFORCE, 'list_view'),
  [CUSTOM_OBJECT_ANNOTATIONS.FIELD_SETS]: new ElemID(SALESFORCE, 'field_set'),
  [CUSTOM_OBJECT_ANNOTATIONS.COMPACT_LAYOUTS]: new ElemID(SALESFORCE, 'compact_layout'),
  [CUSTOM_OBJECT_ANNOTATIONS.SHARING_REASONS]: new ElemID(SALESFORCE, 'sharing_reason'),
  [CUSTOM_OBJECT_ANNOTATIONS.INDEXES]: new ElemID(SALESFORCE, 'index'),
}

const getFieldType = (type: string): Type =>
  (_.isUndefined(type) ? BuiltinTypes.STRING : Types.get(bpCase(type)))

const createObjectWithFields = (objectName: string, serviceIds: ServiceIds,
  fields: Field[]): ObjectType => {
  const obj = Types.get(objectName, true, false, serviceIds) as ObjectType
  fields.forEach(field => {
    obj.fields[field.name] = field
  })
  return obj
}

const getCustomObjectPackagePath = (obj: ObjectType): string[] => {
  if (hasNamespace(obj)) {
    return [SALESFORCE, 'installed_packages', getNamespace(obj), 'objects', obj.elemID.name]
  }
  return [SALESFORCE, 'objects', 'custom', obj.elemID.name]
}

const getPartialCustomObjects = (customFields: Field[], objectName: string,
  serviceIds: ServiceIds): ObjectType[] => {
  const [packagedFields, regularCustomFields] = _.partition(customFields, f => hasNamespace(f))
  const namespaceToFields: Record<string, Field[]> = _.groupBy(packagedFields, f => getNamespace(f))
  // Custom fields that belong to a package go in a separate element
  const customParts = Object.entries(namespaceToFields)
    .map(([namespace, packageFields]) => {
      const packageObj = createObjectWithFields(objectName, serviceIds, packageFields)
      packageObj.path = [SALESFORCE, 'installed_packages',
        namespace, 'objects', packageObj.elemID.name]
      return packageObj
    })
  if (!_.isEmpty(regularCustomFields)) {
    // Custom fields go in a separate element
    const customPart = createObjectWithFields(objectName, serviceIds, regularCustomFields)
    customPart.path = [SALESFORCE, 'objects', 'custom', customPart.elemID.name]
    customParts.push(customPart)
  }
  return customParts
}

const createSObjectTypes = (
  objectName: string,
  label: string,
  isCustom: boolean,
  fields: SObjField[],
): ObjectType[] => {
  const serviceIds = {
    [ADAPTER]: SALESFORCE,
    [API_NAME]: objectName,
    [METADATA_TYPE]: CUSTOM_OBJECT,
  }

  const element = Types.get(objectName, true, false, serviceIds) as ObjectType
  addApiName(element, objectName)
  addMetadataType(element)
  addLabel(element, label)

  // Filter out nested fields of compound fields
  const filteredFields = fields.filter(field => !field.compoundFieldName)

  // Set standard fields on element
  filteredFields
    .filter(f => !f.custom)
    .map(f => getSObjectFieldElement(element, f, serviceIds))
    .forEach(field => {
      element.fields[field.name] = field
    })

  // Create custom fields (if any)
  const customFields = filteredFields
    .filter(f => f.custom)
    .map(f => getSObjectFieldElement(element, f, serviceIds))

  if (isCustom) {
    // This is custom object, we treat standard fields as if they were custom as well
    // so we put all fields in the same element definition
    customFields.forEach(field => {
      element.fields[field.name] = field
    })
    element.path = getCustomObjectPackagePath(element)
    return [element]
  }

  // This is a standard object
  element.path = [SALESFORCE, 'objects', 'standard', element.elemID.name]

  if (_.isEmpty(customFields)) {
    // No custom parts, only standard element needed
    return [element]
  }
  return [element, ...getPartialCustomObjects(customFields, objectName, serviceIds)]
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
        if (typeName === FIELD_TYPE_API_NAMES[FIELD_TYPE_NAMES.CHECKBOX]) {
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
          annotations[FIELD_ANNOTATIONS.VALUE_SET] = v[VALUE_SET_FIELDS
            .VALUE_SET_DEFINITION][VALUE_SET_DEFINITION_FIELDS.VALUE]
          annotations[FIELD_ANNOTATIONS.RESTRICTED] = v[VALUE_SET_FIELDS.RESTRICTED] || false
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

const buildAnnotationsObjectType = (fieldType: Type): ObjectType => {
  const annotationTypesElemID = new ElemID(SALESFORCE, 'annotation_type')
  return new ObjectType({ elemID: annotationTypesElemID,
    fields: Object.assign({}, ...Object.entries(fieldType.annotationTypes)
      .concat(Object.entries(BuiltinAnnotationTypes))
      .map(([k, v]) => ({ [k]: new Field(annotationTypesElemID, k, v) }))) })
}

const transformFieldAnnotations = (
  instanceFieldValues: Values,
  parentApiName: string
): Values => {
  // Ignores typeless/unknown typed instances
  if (!_.has(instanceFieldValues, INSTANCE_TYPE_FIELD)) {
    return {}
  }

  const getFieldTypeFromName = (typeName: string): Type | undefined => {
    const apiTypeName = Object.entries(FIELD_TYPE_API_NAMES)
      .find(([_k, v]) => v === typeName)?.[0]
    const dataTypeName = apiTypeName === 'checkbox' ? 'boolean' : apiTypeName
    return dataTypeName
      ? (Types.getKnownType(dataTypeName, true) || Types.getKnownType(dataTypeName, false))
      : undefined
  }

  const fieldType = getFieldTypeFromName(instanceFieldValues[INSTANCE_TYPE_FIELD])
  if (_.isUndefined(fieldType)) {
    return {}
  }

  const annotations = transfromAnnotationsNames(instanceFieldValues, parentApiName)
  const annotationsType = buildAnnotationsObjectType(fieldType)
  convertList(annotationsType, annotations)

  return transform(annotations, annotationsType, transformPrimitive) || {}
}

const transformObjectAnnotations = (customObject: ObjectType, annotationTypesFromInstance: TypeMap,
  instance: InstanceElement): void => {
  const transformAnnotationValue = (values: Values, annotationType: ObjectType):
    Values | undefined => {
    values[INSTANCE_FULL_NAME_FIELD] = [apiName(instance), values[INSTANCE_FULL_NAME_FIELD]]
      .join(API_NAME_SEPERATOR)
    return transform(values, annotationType, transformPrimitive)
  }

  Object.assign(customObject.annotationTypes, annotationTypesFromInstance)

  Object.assign(customObject.annotations,
    ...Object.entries(instance.value)
      .filter(([k, _v]) => Object.keys(annotationTypesFromInstance).includes(k))
      .map(([k, v]) => {
        const annotationType = customObject.annotationTypes[k] as ObjectType
        const transformedValue = _.isArray(v)
          ? v.map(innerValue => transformAnnotationValue(innerValue, annotationType))
            .filter(innerValue => !_.isUndefined(innerValue))
          : transformAnnotationValue(v, annotationType) || {}
        return { [k]: transformedValue }
      }))
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
    // assigning annotations only to the "main" ObjectType
    transformObjectAnnotations(customObject, annotationTypesFromInstance, instance)
  }
}

const createObjectTypeFromInstance = (instance: InstanceElement): ObjectType => {
  const objectName = instance.value[INSTANCE_FULL_NAME_FIELD]
  const objectElemID = new ElemID(SALESFORCE, bpCase(objectName), 'type')
  const instanceFields = makeArray(instance.value.fields)
  const object = new ObjectType({ elemID: objectElemID,
    fields: Object.assign({}, ...instanceFields
      .map((field: Values) => {
        const fieldFullName = bpCase(field[INSTANCE_FULL_NAME_FIELD])
        return { [fieldFullName]: new Field(objectElemID,
          fieldFullName, getFieldType(field[INSTANCE_TYPE_FIELD]),
          transformFieldAnnotations(field, objectName)) }
      })),
    annotations: { [API_NAME]: objectName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [LABEL]: instance.value[LABEL] } })
  const objectPathType = bpCase(objectName).endsWith(SALESFORCE_CUSTOM_SUFFIX) ? 'custom' : 'standard'
  object.path = [SALESFORCE, 'objects',
    objectPathType, bpCase(objectName)]
  return object
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

const createCustomObjectTypesFromSObjectsAndInstances = (
  sObjects: DescribeSObjectResult[],
  instances: Record<string, InstanceElement>,
  annotationTypesFromInstance: TypeMap
): ObjectType[] =>
  _.flatten(sObjects.map(({ name, label, custom, fields }) => {
    const objects = createSObjectTypes(name, label, custom, fields)
    if (instances[name]) {
      const fieldNameToFieldAnnotations = _(makeArray(instances[name].value.fields))
        .map(field => [field[INSTANCE_FULL_NAME_FIELD], field])
        .fromPairs()
        .value()
      objects.forEach(obj => mergeCustomObjectWithInstance(
        obj, fieldNameToFieldAnnotations, instances[name], annotationTypesFromInstance
      ))
    }
    return objects
  }))

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

    const annotationTypesToMergeFromInstance = (): TypeMap => {
      const annotationTypesFromInstance = _(customObjectAnnotationTypeIds)
        .entries()
        .map(([name, elemID]) => [name, findObjectType(elements, elemID) as ObjectType])
        .fromPairs()
        .value()
      // Fix some annotationTypes definitions
      if (annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS]) {
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS].fields.columns
          .isList = true
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS].fields.filters
          .isList = true
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS].fields.filters.type.fields
          .operation = new Field(
            annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS].fields.filters.type.elemID, 'operation',
            BuiltinTypes.STRING, {
              [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
              [CORE_ANNOTATIONS.VALUES]: [
                'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual',
                'greaterOrEqual', 'contains', 'notContain', 'startsWith',
                'includes', 'excludes', 'within',
              ],
            },
          )
        // eslint-disable-next-line @typescript-eslint/camelcase
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS].fields.filter_scope = new
        Field(
          customObjectAnnotationTypeIds[CUSTOM_OBJECT_ANNOTATIONS.LIST_VIEWS], 'filter_scope',
          BuiltinTypes.STRING, {
            [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
            [CORE_ANNOTATIONS.VALUES]: ['Everything', 'Mine',
              'MineAndMyGroups', 'Queue', 'Delegated', 'MyTerritory', 'MyTeamTerritory', 'Team'],
          }
        )
      }
      if (annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.FIELD_SETS]) {
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.FIELD_SETS].fields.available_fields
          .isList = true
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.FIELD_SETS].fields.displayed_fields
          .isList = true
      }
      if (annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.COMPACT_LAYOUTS]) {
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.COMPACT_LAYOUTS].fields.fields
          .isList = true
      }
      if (annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.WEB_LINKS]) {
        // eslint-disable-next-line @typescript-eslint/camelcase
        annotationTypesFromInstance[CUSTOM_OBJECT_ANNOTATIONS.WEB_LINKS].fields.display_type = new
        Field(
          customObjectAnnotationTypeIds[CUSTOM_OBJECT_ANNOTATIONS.WEB_LINKS], 'display_type',
          BuiltinTypes.STRING, {
            [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
            [CORE_ANNOTATIONS.VALUES]: ['link', 'button', 'massActionButton'],
          }
        )
      }
      return annotationTypesFromInstance
    }

    const customObjectTypes = createCustomObjectTypesFromSObjectsAndInstances(
      _.flatten(Object.values(sObjects)),
      customObjectInstances,
      annotationTypesToMergeFromInstance(),
    )

    const objectTypeNames = new Set(Object.keys(sObjects))
    Object.entries(customObjectInstances).forEach(([instanceApiName, instance]) => {
      // Adds objects that exists in the metadata api but don't exist in the soap api
      if (!objectTypeNames.has(instanceApiName)) {
        customObjectTypes.push(createObjectTypeFromInstance(instance))
      }
    })

    const objectTypeFullNames = new Set(elements.filter(isObjectType).map(elem => id(elem)))
    _.remove(elements, elem => (isCustomObject(elem) && isInstanceElement(elem)))
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

    return _.flatten(_.flatten((await Promise.all(Object.entries(customObjectAnnotationTypeIds)
      .map(([annotationName, elemID]) =>
        handleObjectAnnotationChanges(annotationName,
          sfCase(elemID.name)))))))
  },

  onAdd: async (after: Element): Promise<UpsertResult[]> => {
    if (!(isObjectType(after))) {
      return []
    }
    return _.flatten((await Promise.all(Object.entries(customObjectAnnotationTypeIds)
      .map(([annotationName, elemID]) =>
        client.upsert(sfCase(elemID.name),
          makeArray(after.annotations[annotationName])
            .map(val => toMetadataInfo(val[INSTANCE_FULL_NAME_FIELD], val)))))))
  },
})

export default filterCreator
