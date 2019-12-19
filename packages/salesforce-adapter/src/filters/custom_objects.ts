import { logger } from '@salto/logging'
import { ADAPTER, Element, Field, ObjectType, ServiceIds, Type, isObjectType } from 'adapter-api'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField } from 'jsforce'
import _ from 'lodash'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, NAMESPACE_SEPARATOR, SALESFORCE } from '../constants'
import { FilterCreator } from '../filter'
import { apiName, getSObjectFieldElement, Types } from '../transformers/transformer'
import { id, addApiName, addMetadataType, addLabel } from './utils'

const log = logger(module)

const hasNamespace = (customElement: Field | ObjectType): boolean =>
  apiName(customElement).split(NAMESPACE_SEPARATOR).length === 3

const getNamespace = (customElement: Field | ObjectType): string =>
  apiName(customElement).split(NAMESPACE_SEPARATOR)[0]

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
      })
    sObjects.forEach(elem => elements.push(elem))
  },
})

export default filterCreator
