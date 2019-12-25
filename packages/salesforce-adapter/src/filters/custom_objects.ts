import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import { ADAPTER, Element, Field, ObjectType, ServiceIds, Type, isObjectType, InstanceElement,
  Values, isInstanceElement, ElemID, BuiltinTypes } from 'adapter-api'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField } from 'jsforce'
import _ from 'lodash'
import { transformPrimitiveAnnotations } from './convert_types'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, NAMESPACE_SEPARATOR, SALESFORCE,
  INSTANCE_FULL_NAME_FIELD, SALESFORCE_CUSTOM_SUFFIX, INSTANCE_TYPE_FIELD, LABEL, FIELD_TYPE_API_NAMES, DEFAULT_VALUE_FORMULA } from '../constants'
import { FilterCreator } from '../filter'
import { apiName, getSObjectFieldElement, Types, isCustomObject, bpCase } from '../transformers/transformer'
import { id, addApiName, addMetadataType, addLabel } from './utils'

const log = logger(module)
const { makeArray } = collections.array

const hasNamespace = (customElement: Field | ObjectType): boolean =>
  apiName(customElement).split(NAMESPACE_SEPARATOR).length === 3

const getNamespace = (customElement: Field | ObjectType): string =>
  apiName(customElement).split(NAMESPACE_SEPARATOR)[0]

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
  const [packagedFields, regularCustomFields] = _.partition(customFields, hasNamespace)
  const namespaceToFields: Record<string, Field[]> = _.groupBy(packagedFields, getNamespace)
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
    const customObjects = await client.listMetadataObjects(CUSTOM_OBJECT)
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

const fixInstanceFieldValueBeforeMergeToAnnotations = (instanceFieldValues: Values): Values => {
  // Ignores typeless/unknown typed instances
  if (!_.has(instanceFieldValues, INSTANCE_TYPE_FIELD)) {
    return {}
  }
  const getFieldTypeFromName = (typeName: string): Type | undefined => {
    const apiTypeName = Object.entries(FIELD_TYPE_API_NAMES)
      .find(([_k, v]) => v === typeName)?.[0]
    const dataTypeName = apiTypeName === 'checkbox' ? 'boolean' : apiTypeName
    return dataTypeName ? (Types.primitiveDataTypes[dataTypeName]
      || Types.compoundDataTypes[dataTypeName]) : undefined
  }

  const fieldType = getFieldTypeFromName(instanceFieldValues[INSTANCE_TYPE_FIELD])
  if (_.isUndefined(fieldType)) {
    return {}
  }

  return transformPrimitiveAnnotations(Object.assign({},
    ...Object.entries(instanceFieldValues).map(([k, v]) => {
      switch (k) {
        case 'required':
          return { [Type.ANNOTATIONS.REQUIRED]: v }
        case INSTANCE_FULL_NAME_FIELD:
          return { [API_NAME]: v }
        case 'default_value':
          return { [DEFAULT_VALUE_FORMULA]: v }
        case 'value_set':
          return { [Type.ANNOTATIONS.VALUES]: v.value_set_definition.value
            .map((value: Values) => value.full_name) }
        default:
          return { [k]: v }
      }
    })), fieldType)
}

const mergeCustomObjectWithInstance = (customObject: ObjectType,
  instance: InstanceElement): void => {
  _(customObject.fields).forEach(field => {
    Object.assign(field.annotations, fixInstanceFieldValueBeforeMergeToAnnotations(
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
      .map((field: Values) => ({ [bpCase(field[INSTANCE_FULL_NAME_FIELD])]: new Field(objectElemID,
        bpCase(field[INSTANCE_FULL_NAME_FIELD]), getFieldType(field[INSTANCE_TYPE_FIELD]),
        fixInstanceFieldValueBeforeMergeToAnnotations(field)) }))),
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
      const objectsTypesOfInstance = sObjects
        .filter(obj => obj.elemID.name === instance.elemID.name)
      // Adds objects that exists in the metadata api but don't exist in the soap api
      if (_.isEmpty(objectsTypesOfInstance)) {
        sObjects.push(createObjectTypeFromInstance(instance))
      } else {
        // Adds fields that exists in the metadata api but don't exist in the soap api
        const instanceFields = makeArray(instance.value.fields)
        const newFields = instanceFields.filter((f: Values) =>
          _.isUndefined(_.flatten(objectsTypesOfInstance
            .map(o => Object.values(o.fields).map(v => v.name)))
            .find(fieldName => fieldName === bpCase(f[INSTANCE_FULL_NAME_FIELD]))))
        newFields.forEach((field: Values) => {
          const objectPath = field[INSTANCE_FULL_NAME_FIELD]
            .endsWith(SALESFORCE_CUSTOM_SUFFIX) ? 'custom' : 'standard'
          const objectTypeOfInstance = objectsTypesOfInstance
            .find(objType => objType.path && (objType.path[1] === objectPath))
            || objectsTypesOfInstance[0]
          const fullNameBpCased = bpCase(field[INSTANCE_FULL_NAME_FIELD])
          objectTypeOfInstance.fields[fullNameBpCased] = new Field(
            objectTypeOfInstance.elemID, fullNameBpCased,
            getFieldType(field[INSTANCE_TYPE_FIELD]),
            fixInstanceFieldValueBeforeMergeToAnnotations(field)
          )
        })
      }
    })

    _.remove(elements, elem => (isCustomObject(elem) && isInstanceElement(elem)))
    sObjects.forEach(elem => elements.push(elem))
  },
})

export default filterCreator
