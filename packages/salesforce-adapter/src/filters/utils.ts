import _ from 'lodash'
import { logger } from '@salto/logging'
import { Element, Field, isObjectType, ObjectType, InstanceElement, isInstanceElement } from 'adapter-api'
import { API_NAME, CUSTOM_FIELD } from '../constants'
import { CustomField, JSONBool } from '../client/types'
import { fieldFullName, isCustomObject, metadataType } from '../transformers/transformer'
import SalesforceClient from '../client/client'

const log = logger(module)

export const id = (elem: Element): string => elem.elemID.getFullName()

export const boolValue = (val: JSONBool):
 boolean => val === 'true' || val === true

export const getInstancesOfMetadataType = (elements: Element[], metadataTypeName: string):
 InstanceElement[] =>
  elements.filter(isInstanceElement)
    .filter(element => metadataType(element) === metadataTypeName)

const readSalesforceFields = async (client: SalesforceClient, fieldNames: string[]):
  Promise<Record<string, CustomField>> => (
  _(await client.readMetadata(CUSTOM_FIELD, fieldNames)
    .catch(e => {
      log.error('failed to read fields %o reason: %o', fieldNames, e)
      return []
    }))
    .map(field => [field.fullName, field])
    .fromPairs()
    .value()
)

export const getCustomObjects = (elements: Element[]): ObjectType[] =>
  elements
    .filter(isObjectType)
    .filter(isCustomObject)

// collect Object Type's elemID to api name as we have custom Object Types that are split and
// we need to know the api name to build full field name
export const generateObjectElemID2ApiName = (customObjects: ObjectType[]): Record<string, string> =>
  _(customObjects)
    .filter(obj => obj.annotations[API_NAME])
    .map(obj => [id(obj), obj.annotations[API_NAME]])
    .fromPairs()
    .value()

export const runOnFields = async (elements: Element[], condition: (field: Field) => boolean,
  runOnField: (field: Field, salesforceField: CustomField) => void, client: SalesforceClient):
  Promise<void> => {
  const getSalesforceFieldFullName = (field: Field,
    objectElemID2ApiName: Record<string, string>): string =>
    fieldFullName(objectElemID2ApiName[field.parentID.getFullName()], field)

  const customObjects = getCustomObjects(elements)
  const objectElemID2ApiName = generateObjectElemID2ApiName(customObjects)
  const fields = _(customObjects)
    .map(obj => Object.values(obj.fields))
    .flatten()
    .filter(condition)
    .value()
  const salesforceFieldNames = fields
    .map(f => getSalesforceFieldFullName(f, objectElemID2ApiName))
  const name2Field = await readSalesforceFields(client, salesforceFieldNames)
  fields.forEach(field => {
    const salesforceField = name2Field[getSalesforceFieldFullName(field, objectElemID2ApiName)]
    runOnField(field, salesforceField)
  })
}

export const boolValue = (val: boolean | 'true' | 'false'): boolean => val === 'true' || val === true
