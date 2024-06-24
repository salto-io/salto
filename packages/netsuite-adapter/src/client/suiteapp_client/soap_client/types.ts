/*
 *                      Copyright 2024 Salto Labs Ltd.
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
type StatusSuccess = {
  attributes: {
    isSuccess: 'true'
  }
}

type StatusError = {
  attributes: {
    isSuccess: 'false'
  }
  statusDetail: [
    {
      code: string
      message: string
    },
  ]
}

export type GetSuccess = {
  readResponse: {
    record: {
      content?: string
    }
    status: StatusSuccess
  }
}

export type GetError = {
  readResponse: {
    status: StatusError
  }
}

export type GetResult = GetSuccess | GetError

export const isGetSuccess = (result: GetResult): result is GetSuccess =>
  result.readResponse.status.attributes.isSuccess === 'true'

export type WriteResponseSuccess = {
  status: StatusSuccess
  baseRef: {
    attributes: {
      internalId: string
    }
  }
}

export type WriteResponseError = {
  status: StatusError
}

export type WriteResponse = WriteResponseSuccess | WriteResponseError

export const isWriteResponseSuccess = (result: WriteResponse): result is WriteResponseSuccess =>
  result.status.attributes.isSuccess === 'true'

export const isWriteResponseError = (result: WriteResponse): result is WriteResponseError =>
  result.status.attributes.isSuccess === 'false'

export type DeployListSuccess = {
  writeResponseList: {
    writeResponse: WriteResponse[]
    status: StatusSuccess
  }
}

export type DeployListError = {
  writeResponseList: {
    status: StatusError
  }
}

export type DeployListResults = DeployListError | DeployListSuccess

export const isDeployListSuccess = (result: DeployListResults): result is DeployListSuccess =>
  result.writeResponseList.status.attributes.isSuccess === 'true'

export type RecordValue = Record<string, unknown> & {
  attributes: {
    internalId: string
  }
}

export type SearchResponse = {
  searchResult: {
    totalPages: number
    searchId: string
    recordList: {
      record: RecordValue[]
    } | null
  }
}

export type SoapSearchType = {
  type: string
} & (
  | {
      subtypes: string[]
      originalTypes: string[]
    }
  | {
      subtypes?: never
      originalTypes?: never
    }
)

export type SearchPageResponse = {
  records: RecordValue[]
  excludedFromSearch: boolean
}

export type SearchErrorResponse = {
  searchResult: {
    status: StatusError
  }
}

export const isSearchErrorResponse = (
  response: SearchResponse | SearchErrorResponse,
): response is SearchErrorResponse =>
  'status' in response.searchResult && response.searchResult.status.attributes.isSuccess === 'false'

type GetAllSuccessResponse = {
  getAllResult: {
    recordList: {
      record: RecordValue[]
    }
  }
}

type GetAllErrorResponse = {
  getAllResult: {
    status: StatusError
  }
}

export type GetAllResponse = GetAllSuccessResponse | GetAllErrorResponse

export const isGetAllErrorResponse = (response: GetAllResponse): response is GetAllErrorResponse =>
  'status' in response.getAllResult && response.getAllResult.status.attributes.isSuccess === 'false'

type CustomRecordTypeRecords = {
  type: string
  records: RecordValue[]
}

export type CustomRecordResponse = {
  customRecords: CustomRecordTypeRecords[]
  largeTypesError: string[]
}

export type RecordResponse = { records: RecordValue[]; largeTypesError: string[] }

export const SOAP_FIELDS_TYPES = {
  BOOLEAN: 'platformCore:BooleanCustomFieldRef',
  STRING: 'platformCore:StringCustomFieldRef',
  DOUBLE: 'platformCore:DoubleCustomFieldRef',
  DATE: 'platformCore:DateCustomFieldRef',
  SELECT: 'platformCore:SelectCustomFieldRef',
  LONG: 'platformCore:LongCustomFieldRef',
  MULTISELECT: 'platformCore:MultiSelectCustomFieldRef',
}

type GetSelectValueErrorResponse = {
  status: StatusError
}

type GetSelectValueSuccessResponse = {
  status: StatusSuccess
  totalRecords: number
  totalPages: number
  baseRefList?: {
    baseRef: {
      attributes: {
        internalId: string
      }
      name: string
    }[]
  }
}

export type GetSelectValueResponse = {
  getSelectValueResult: GetSelectValueErrorResponse | GetSelectValueSuccessResponse
}

export const isGetSelectValueSuccessResponse = (
  response: GetSelectValueResponse,
): response is { getSelectValueResult: GetSelectValueSuccessResponse } =>
  response.getSelectValueResult.status.attributes.isSuccess === 'true'
