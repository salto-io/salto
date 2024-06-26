import { FileProperties } from "@salto-io/jsforce-types"
import { logger } from "@salto-io/logging"
import { collections, values } from "@salto-io/lowerdash"
import _ from "lodash"
import { CustomListFunc } from "src/client/client"
import { SalesforceRecord } from "src/client/types"
import { APEX_CLASS_METADATA_TYPE } from "src/constants"

const {isDefined} = values
const {awu} = collections.asynciterable

const log = logger(module)


type ApexClassRecord = SalesforceRecord & {
  NamespacePrefix: string
  Name: string
  CreatedDate: string
  CreatedBy: { Name: string }
  LastModifiedDate: string
  LastModifiedBy: { Name: string }
}

const isApexClassRecord = (record: unknown): record is ApexClassRecord => (
  _.isString(_.get(record, 'Id')) &&
  _.isString(_.get(record, 'NamespacePrefix')) &&
  _.isString(_.get(record, 'Name')) &&
  _.isString(_.get(record, 'CreatedDate')) &&
  _.isString(_.get(record, 'CreatedBy', 'Name')) &&
  _.isString(_.get(record, 'LastModifiedDate')) &&
  _.isString(_.get(record, 'LastModifiedBy', 'Name'))
)

export const listApexClasses: CustomListFunc = async ({client, sinceDate}) => {
  const query = [
    'SELECT Id, NamespacePrefix, Name, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name',
    'FROM ApexClass',
    sinceDate ? `WHERE LastModifiedDate > ${sinceDate}` : undefined,
  ]
  .filter(isDefined)
  .join(' ')
  const records: unknown[] = await (await awu(await client.queryAll(query)).toArray()).flat()
  if (!records.every(isApexClassRecord)) {
    log.warn('Fetched ApexClass Records are invalid, falling back to metadata list instead.')
    return (await client.listMetadataObjects({type: APEX_CLASS_METADATA_TYPE})).result
  }
  return records.map<FileProperties>((record: ApexClassRecord) => {
    const fullName = record.NamespacePrefix !== '' ? `${record.NamespacePrefix}__${record.Name}` : record.Name
    return {
    type: APEX_CLASS_METADATA_TYPE,
    id: record.Id,
    fullName: record.Name,
    createdByName: record.CreatedBy.Name,
    createdById: '',
    fileName: `classes/${fullName}.cls`,
    createdDate: record.CreatedDate,
    lastModifiedById: '',
    lastModifiedByName: record.LastModifiedBy.Name,
    lastModifiedDate: record.LastModifiedDate,
    namespacePrefix: record.NamespacePrefix,
  }})
} 