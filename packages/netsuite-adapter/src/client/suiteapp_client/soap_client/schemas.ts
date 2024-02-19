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

const SUCCESS_STATUS = {
  required: ['attributes'],
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      required: ['isSuccess'],
      properties: {
        isSuccess: {
          type: 'string',
          enum: ['true'],
        },
      },
    },
  },
}

const ERROR_RESPONSE = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'object',
      required: ['attributes', 'statusDetail'],
      properties: {
        attributes: {
          type: 'object',
          required: ['isSuccess'],
          properties: {
            isSuccess: {
              type: 'string',
              enum: ['false'],
            },
          },
        },
        statusDetail: {
          type: 'array',
          maxItems: 1,
          minItems: 1,
          items: [
            {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                },
                message: {
                  type: 'string',
                },
              },
            },
          ],
        },
      },
    },
  },
}

const GET_RESULTS_SUCCESS_SCHEMA = {
  type: 'object',
  required: ['record', 'status'],
  properties: {
    status: SUCCESS_STATUS,
    record: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
        },
      },
    },
  },
}

export const GET_RESULTS_SCHEMA = {
  type: 'object',
  required: ['readResponse'],
  properties: {
    readResponse: {
      anyOf: [ERROR_RESPONSE, GET_RESULTS_SUCCESS_SCHEMA],
    },
  },
}

const WRITE_RESPONSE_SUCCESS_SCHEMA = {
  type: 'object',
  required: ['baseRef', 'status'],
  properties: {
    status: SUCCESS_STATUS,
    baseRef: {
      type: 'object',
      required: ['attributes'],
      properties: {
        attributes: {
          type: 'object',
          required: ['internalId'],
          properties: {
            internalId: {
              type: 'string',
            },
          },
        },
      },
    },
  },
}

const DEPLOY_LIST_SUCCESS_SCHEMA = {
  type: 'object',
  required: ['status', 'writeResponse'],
  properties: {
    status: SUCCESS_STATUS,
    writeResponse: {
      type: 'array',
      items: {
        anyOf: [ERROR_RESPONSE, WRITE_RESPONSE_SUCCESS_SCHEMA],
      },
    },
  },
}

export const DEPLOY_LIST_SCHEMA = {
  type: 'object',
  required: ['writeResponseList'],
  properties: {
    writeResponseList: {
      anyOf: [ERROR_RESPONSE, DEPLOY_LIST_SUCCESS_SCHEMA],
    },
  },
}

const RECORD_DEFINITION = {
  type: 'object',
  required: ['attributes'],
  properties: {
    attributes: {
      type: 'object',
      required: ['internalId'],
      properties: {
        internalId: { type: 'string' },
      },
    },
  },
}

const SEARCH_SUCCESS_SCHEMA = {
  type: 'object',
  required: ['recordList', 'searchId', 'totalPages'],
  properties: {
    recordList: {
      type: 'object',
      required: ['record'],
      nullable: true,
      properties: {
        record: {
          type: 'array',
          items: RECORD_DEFINITION,
        },
      },
    },
    searchId: {
      type: 'string',
    },
    totalPages: {
      type: 'number',
    },
  },
}

export const SEARCH_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['searchResult'],
  properties: {
    searchResult: {
      anyOf: [ERROR_RESPONSE, SEARCH_SUCCESS_SCHEMA],
    },
  },
}

const GET_SELECT_VALUE_SUCCESS_SCHEMA = {
  type: 'object',
  required: ['status', 'totalRecords', 'totalPages'],
  properties: {
    status: SUCCESS_STATUS,
    totalRecords: {
      type: 'number',
    },
    totalPages: {
      type: 'number',
    },
    baseRefList: {
      type: 'object',
      required: ['baseRef'],
      properties: {
        baseRef: {
          type: 'array',
          items: {
            type: 'object',
            required: ['attributes', 'name'],
            properties: {
              attributes: {
                type: 'object',
                required: ['internalId'],
                properties: {
                  internalId: {
                    type: 'string',
                  },
                },
              },
              name: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
}

export const GET_SELECT_VALUE_SCHEMA = {
  type: 'object',
  required: ['getSelectValueResult'],
  properties: {
    getSelectValueResult: {
      anyOf: [ERROR_RESPONSE, GET_SELECT_VALUE_SUCCESS_SCHEMA],
    },
  },
}

const GET_ALL_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['recordList'],
  properties: {
    recordList: {
      type: 'object',
      required: ['record'],
      properties: {
        record: {
          items: RECORD_DEFINITION,
          type: 'array',
        },
      },
    },
  },
}

export const GET_ALL_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['getAllResult'],
  properties: {
    getAllResult: {
      anyOf: [ERROR_RESPONSE, GET_ALL_SUCCESS_RESPONSE_SCHEMA],
    },
  },
}
