/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export const SUPPORTED_WSDL_VERSIONS = ['2020_2', '2023_1', '2023_2', '2024_1'] as const

export type WSDLVersion = (typeof SUPPORTED_WSDL_VERSIONS)[number]

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

type GetSuccess = {
  readResponse: {
    record: {
      content?: string
    }
    status: StatusSuccess
  }
}

type GetError = {
  readResponse: {
    status: StatusError
  }
}

export type GetResult = GetSuccess | GetError

export const isGetSuccess = (result: GetResult): result is GetSuccess =>
  result.readResponse.status.attributes.isSuccess === 'true'

type WriteResponseSuccess = {
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

export type SoapDeployResult =
  | {
      isSuccess: true
      internalId: string
    }
  | {
      isSuccess: false
      errorMessage: string
    }

type DeployListSuccess = {
  writeResponseList: {
    writeResponse: WriteResponse[]
    status: StatusSuccess
  }
}

type DeployListError = {
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
