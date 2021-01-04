/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { Values } from '@salto-io/adapter-api'

export type Credentials = {
  endpoint: string
  clientId: string
  clientSecret: string
  identity?: Identity
}

export type Identity = {
  accessToken: string
  scope: string
  expiresIn: number
  tokenType: string
}

export interface MarketoMetadata {
  name: string
}

export interface MarketoResponse {
  requestId: string // Id of the request made
  success: boolean // Whether the request succeeded
  result: Values[] // Array of results for individual records in the operation
  moreResult?: boolean // Boolean indicating if there are more results in subsequent pages
  nextPageToken?: string // Paging token given if the result set exceeded the allowed batch size
  errors: MarketoError[] // Array of errors that occurred if the request was unsuccessful
  warnings: MarketoWarning[] // Array of warnings given for the operation
}

export interface MarketoError {
  code: number // Integer error code of the error ,
  message: string // Message describing the cause of the Error
}

export interface MarketoWarning {
  code: number // Integer code of the warning ,
  message: string // Message describing the warning
}

export interface Lead extends MarketoMetadata {
  membership: ProgramMembership
  status?: string
  reason?: string
}

export interface ProgramMembership {
  acquiredBy?: boolean // Whether the lead was acquired by the parent program
  isExhausted?: boolean // Whether the lead is currently exhausted in the stream, if applicable
  membershipDate?: string // Date the lead first became a member of the program
  nurtureCadence?: string // Cadence of the parent stream if applicable
  progressionStatus?: string // Program status of the lead in the parent program
  reachedSuccess?: boolean // Whether the lead is in a success-status in the parent program
  stream?: string // Stream that the lead is a member of
}

export interface LeadAttribute {
  id: number // Unique integer id of the field
  dataType: string // Datatype of the field
  displayName: string // UI display-name of the field
  length?: number // Max length of the field. Only applicable to text, string, and text area.
  rest: LeadMapAttribute // Description of REST API usage attributes
  soap: LeadMapAttribute // Description of SOAP API usage attributes
}

export interface LeadMapAttribute {
  name: string // Name of the attribute
  readOnly?: boolean // Whether the attribute is read only
}

export interface CustomObject extends MarketoMetadata {
  idField: string // Primary id key of the object type
  displayName: string // UI display-name of the object type
  pluralName: string // UI plural-name of the custom object type
  description: string // Description of the object type
  dedupeFields: string[] // List of dedupe fields. Arrays with multiple members are compound keys
  searchableFields: string[][] // List of fields valid for use as a filter type in a query
  fields: Field[] // List of fields available on the object type
  state?: 'draft' | 'approved' | 'approvedWithDraft' // Approval state of object type
  relationships: Relation[] // List of relationships which the object has
  createdAt: string // Datetime when the object type was created
  apiName: string // Name of the object type
  updatedAt: string // Datetime when the object type was most recently updated
  version: 'draft' | 'approved' // Version of object type that is returned in response
}

export interface Field {
  name: string // Name of the field
  dataType: string // Datatype of the field
  displayName?: string // UI display-name of the field
  length?: number // Max length of the field. Only applicable to text, string, and text area.
  updateable?: boolean // Whether the field is updateable
  crmManaged?: boolean // Whether the field is managed by CRM (native sync)
}

export interface Relation {
  field: string // API Name of link field
  relatedTo: RelatedObject // Object to which the field is linked
  type: string // Type of the relationship field
}

export interface RelatedObject {
  field: string // Name of link field (within link object)
  name: string // Name of the link object
}
