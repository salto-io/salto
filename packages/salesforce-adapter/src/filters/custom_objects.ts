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
  INSTANCE_FULL_NAME_FIELD, SALESFORCE_CUSTOM_SUFFIX, LABEL,
  FIELD_TYPE_API_NAMES } from '../constants'
import { FilterCreator } from '../filter'
import { getSObjectFieldElement, Types, isCustomObject, bpCase } from '../transformers/transformer'
import { id, addApiName, addMetadataType, addLabel, hasNamespace, getNamespace } from './utils'

const log = logger(module)
const { makeArray } = collections.array

export const INSTANCE_DEFAULT_VALUE_FIELD = 'default_value'
export const INSTANCE_VALUE_SET_FIELD = 'value_set'
export const INSTANCE_REQUIRED_FIELD = 'required'
export const INSTANCE_TYPE_FIELD = 'type'

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
  customObjectNames: Set<string>,
): Type[] => {
  // We are filtering sObjects internal types SALTO-346
  if (!customObjectNames.has(objectName)) {
    return []
  }

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

const fetchSObjects = async (client: SalesforceClient): Promise<Type[]> => {
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

  const sobjects = sobjectsDescriptions.map(
    ({ name, label, custom, fields }) => createSObjectTypes(
      name, label, custom, fields, customObjectNames
    )
  )

  return _.flatten(sobjects)
}

const transfromAnnotationsNames = (fields: Values): Values => Object.assign({},
  ...Object.entries(fields).map(([k, v]) => {
    switch (k) {
      case INSTANCE_REQUIRED_FIELD:
        return { [CORE_ANNOTATIONS.REQUIRED]: v }
      case INSTANCE_FULL_NAME_FIELD:
        return { [API_NAME]: v }
      case INSTANCE_DEFAULT_VALUE_FIELD:
        return { [CORE_ANNOTATIONS.DEFAULT]: v }
      case INSTANCE_VALUE_SET_FIELD:
        return { [CORE_ANNOTATIONS.VALUES]: v.value_set_definition.value
          .map((value: Values) => value.full_name) }
      default:
        return { [k]: v }
    }
  }))

const buildAnnotationsObjectType = (fieldType: Type): ObjectType => {
  const annotationTypesElemID = new ElemID(SALESFORCE, 'annotation_type')
  const annotationTypesObject = new ObjectType({ elemID: annotationTypesElemID,
    fields: Object.assign({}, ...Object.entries(fieldType.annotationTypes)
      .concat(Object.entries(BuiltinAnnotationTypes))
      .map(([k, v]) => ({ [k]: new Field(annotationTypesElemID, k, v) }))) })

  annotationTypesObject.fields[CORE_ANNOTATIONS.VALUES] = new Field(
    annotationTypesElemID, CORE_ANNOTATIONS.VALUES, BuiltinTypes.STRING, undefined, true
  )
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

  return transform(transfromAnnotationsNames(instanceFieldValues),
    buildAnnotationsObjectType(fieldType)) || {}
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

// ---

/**
 * Custom objects filter.
 * Fetches the custom objects via the soap api and adds them to the elements
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const sObjects = await fetchSObjects(client)
      .then(
        async types => {
        // All metadata type names include subtypes as well as the "top level" type names
          const metadataTypeNames = new Set(elements.filter(isObjectType)
            .map(elem => id(elem)))
          return types.filter(t => !metadataTypeNames.has(id(t)))
        }
      )
      .catch(e => {
        log.error('failed to fetch sobjects reason: %o', e)
        return []
      }) as ObjectType[]
    const customObjectInstances = elements.filter(isCustomObject).filter(isInstanceElement)

    sObjects.forEach(obj => {
      const matchedInstance = customObjectInstances
        .find(instance => instance.elemID.name === obj.elemID.name)
      if (!_.isUndefined(matchedInstance)) {
        mergeCustomObjectWithInstance(obj, matchedInstance)
      }
    })

    customObjectInstances.forEach(instance => {
      // Adds objects that exists in the metadata api but don't exist in the soap api
      if (!sObjects.find(obj => obj.elemID.name === instance.elemID.name)) {
        sObjects.push(createObjectTypeFromInstance(instance))
      }
    })

    _.remove(elements, elem => (isCustomObject(elem) && isInstanceElement(elem)))
    sObjects.forEach(elem => elements.push(elem))
  },
})

export default filterCreator
