import _ from 'lodash'
import { Element, Field, isObjectType, ObjectType } from 'adapter-api'
import { API_NAME, CUSTOM_FIELD } from '../constants'
import { CustomField } from '../client/types'
import { fieldFullName, isCustomObject } from '../transformers/transformer'
import SalesforceClient from '../client/client'

export const readCustomFields = async (client: SalesforceClient, fieldNames: string[]):
  Promise<Record<string, CustomField>> => (
  _(await client.readMetadata(CUSTOM_FIELD, fieldNames))
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
    .map(obj => [obj.elemID.getFullName(), obj.annotations[API_NAME]])
    .fromPairs()
    .value()

export const getCustomFieldName = (field: Field, objectElemID2ApiName: Record<string, string>):
  string => fieldFullName(objectElemID2ApiName[field.parentID.getFullName()], field)
