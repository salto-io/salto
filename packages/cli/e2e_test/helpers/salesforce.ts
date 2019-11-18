import {
  SalesforceClient,
  testHelpers as salesforceTestHelpers,
  testTypes as salesforceTestTypes,
} from 'salesforce-adapter'
import _ from 'lodash'

export const objectExists = async (client: SalesforceClient, name: string, fields: string[] = [],
  missingFields: string[] = []): Promise<boolean> => {
  const result = (
    await client.readMetadata(salesforceTestHelpers.CUSTOM_OBJECT, name)
  )[0] as salesforceTestTypes.CustomObject
  if (!result || !result.fullName) {
    return false
  }
  let fieldNames: string[] = []
  if (result.fields) {
    fieldNames = _.isArray(result.fields) ? result.fields.map(rf => rf.fullName)
      : [result.fields.fullName]
  }
  if (fields && !fields.every(f => fieldNames.includes(f))) {
    return false
  }
  return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
}

export const instanceExists = async (client: SalesforceClient, type: string, name: string,
  expectedValues?: Record<string, string>): Promise<boolean> => {
  const result = (await client.readMetadata(type, name))[0]
  if (!result || !result.fullName) {
    return false
  }
  if (expectedValues) {
    return Object.entries(expectedValues).every(entry => _.get(result, entry[0]) === entry[1])
  }
  return true
}
