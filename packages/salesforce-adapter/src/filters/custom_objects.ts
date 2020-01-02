import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import { ADAPTER, Element, Field, ObjectType, ServiceIds, Type, isObjectType, InstanceElement,
  Values, isInstanceElement, ElemID, BuiltinTypes,
  CORE_ANNOTATIONS, BuiltinAnnotationTypes } from 'adapter-api'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField } from 'jsforce'
import _ from 'lodash'
import { transform } from './convert_types'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE,
  INSTANCE_FULL_NAME_FIELD, SALESFORCE_CUSTOM_SUFFIX, LABEL, FIELD_DEPENDENCY_FIELDS,
  FIELD_TYPE_API_NAMES, FIELD_ANNOTATIONS,
  LOOKUP_FILTER_FIELDS, VALUE_SETTINGS_FIELDS } from '../constants'
import { FilterCreator } from '../filter'
import { getSObjectFieldElement, Types, isCustomObject, bpCase, apiName } from '../transformers/transformer'
import { id, addApiName, addMetadataType, addLabel, hasNamespace, getNamespace, boolValue } from './utils'
import { convertList } from './convert_lists'

const log = logger(module)
const { makeArray } = collections.array

export const INSTANCE_DEFAULT_VALUE_FIELD = 'default_value'
export const INSTANCE_VALUE_SET_FIELD = 'value_set'
export const INSTANCE_REQUIRED_FIELD = 'required'
export const INSTANCE_TYPE_FIELD = 'type'

export const VALUE_SET_FIELDS = {
  VALUE_SET_DEFINITION: 'value_set_definition',
}

export const VALUE_SET_DEFINITION_FIELDS = {
  VALUE: 'value',
}

export const VALUE_SET_DEFINITION_VALUE_FIELDS = {
  FULL_NAME: 'full_name',
  DEFAULT: 'default',
  LABEL: 'label',
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
    return ['installed_packages', getNamespace(obj), 'objects', obj.elemID.name]
  }
  return ['objects', 'custom', obj.elemID.name]
}

const getPartialCustomObjects = (customFields: Field[], objectName: string,
  serviceIds: ServiceIds): ObjectType[] => {
  const [packagedFields, regularCustomFields] = _.partition(customFields, f => hasNamespace(f))
  const namespaceToFields: Record<string, Field[]> = _.groupBy(packagedFields, f => getNamespace(f))
  // Custom fields that belong to a package go in a separate element
  const customParts = Object.entries(namespaceToFields)
    .map(([namespace, packageFields]) => {
      const packageObj = createObjectWithFields(objectName, serviceIds, packageFields)
      packageObj.path = ['installed_packages', namespace, 'objects', packageObj.elemID.name]
      return packageObj
    })
  if (!_.isEmpty(regularCustomFields)) {
    // Custom fields go in a separate element
    const customPart = createObjectWithFields(objectName, serviceIds, regularCustomFields)
    customPart.path = ['objects', 'custom', customPart.elemID.name]
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
    .map(f => getSObjectFieldElement(element.elemID, f, serviceIds))
    .forEach(field => {
      element.fields[field.name] = field
    })

  // Create custom fields (if any)
  const customFields = filteredFields
    .filter(f => f.custom)
    .map(f => getSObjectFieldElement(element.elemID, f, serviceIds))

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
  element.path = ['objects', 'standard', element.elemID.name]

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

const transfromAnnotationsNames = (fields: Values): Values => {
  const annotations: Values = {}
  Object.entries(fields).forEach(([k, v]) => {
    switch (k) {
      case INSTANCE_REQUIRED_FIELD:
        annotations[CORE_ANNOTATIONS.REQUIRED] = v
        break
      case INSTANCE_FULL_NAME_FIELD:
        annotations[API_NAME] = v
        break
      case INSTANCE_DEFAULT_VALUE_FIELD:
        annotations[CORE_ANNOTATIONS.DEFAULT] = v
        break
      case INSTANCE_VALUE_SET_FIELD:
        annotations[CORE_ANNOTATIONS.VALUES] = v[VALUE_SET_FIELDS
          .VALUE_SET_DEFINITION][VALUE_SET_DEFINITION_FIELDS.VALUE]
          .map((value: Values) => value[VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME])
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
  const annotationTypesObject = new ObjectType({ elemID: annotationTypesElemID,
    fields: Object.assign({}, ...Object.entries(fieldType.annotationTypes)
      .concat(Object.entries(BuiltinAnnotationTypes))
      .map(([k, v]) => ({ [k]: new Field(annotationTypesElemID, k, v) }))) })
  return annotationTypesObject
}

const transformFieldAnnotations = (instanceFieldValues: Values): Values => {
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

  const annotations = transfromAnnotationsNames(instanceFieldValues)
  const annotationsType = buildAnnotationsObjectType(fieldType)
  convertList(annotationsType, annotations)

  return transform(annotations, annotationsType) || {}
}

const mergeCustomObjectWithInstance = (customObject: ObjectType,
  instance: InstanceElement): void => {
  _(customObject.fields).forEach(field => {
    Object.assign(field.annotations, transformFieldAnnotations(
      makeArray(instance.value.fields)
        .find((f: Values) => f.full_name === field.annotations[API_NAME]) || {}
    ))
  })
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
          transformFieldAnnotations(field)) }
      })),
    annotations: { [API_NAME]: objectName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [LABEL]: instance.value[LABEL] } })
  const objectPathType = bpCase(objectName).endsWith(SALESFORCE_CUSTOM_SUFFIX) ? 'custom' : 'standard'
  object.path = ['objects', objectPathType, bpCase(objectName)]
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

  return _.groupBy(sobjectsDescriptions.filter(({ name }) => customObjectNames.has(name)),
    e => e.name)
}

const createCustomObjectTypesFromDescriptions = (
  sObjects: DescribeSObjectResult[],
  instances: Record<string, InstanceElement>
): ObjectType[] =>
  _.flatten(sObjects.map(({ name, label, custom, fields }) => {
    const objects = createSObjectTypes(name, label, custom, fields)
    if (instances[name]) {
      objects.forEach(obj => mergeCustomObjectWithInstance(obj, instances[name]))
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
    const customObjectInstances: Record<string, InstanceElement> = Object.assign({},
      ...elements.filter(isCustomObject).filter(isInstanceElement)
        .map(instance => ({ [apiName(instance)]: instance })))

    const metadataTypeNames = new Set(elements.filter(isObjectType).map(elem => id(elem)))
    const customObjectTypes = createCustomObjectTypesFromDescriptions(
      _.flatten(Object.values(sObjects)),
      customObjectInstances
    ).filter(obj => !metadataTypeNames.has(id(obj)))

    const objectTypeNames = new Set(Object.keys(sObjects))
    Object.entries(customObjectInstances).forEach(([instanceApiName, instance]) => {
      // Adds objects that exists in the metadata api but don't exist in the soap api
      if (!objectTypeNames.has(instanceApiName)) {
        customObjectTypes.push(createObjectTypeFromInstance(instance))
      }
    })

    _.remove(elements, elem => (isCustomObject(elem) && isInstanceElement(elem)))
    customObjectTypes.forEach(elem => elements.push(elem))
  },
})

export default filterCreator
