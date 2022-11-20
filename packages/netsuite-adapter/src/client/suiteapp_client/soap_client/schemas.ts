/*
*                      Copyright 2022 Salto Labs Ltd.
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

// The schemas here were generated automatically using https://github.com/YousefED/typescript-json-schema

export const GET_RESULTS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  anyOf: [
    {
      properties: {
        readResponse: {
          properties: {
            record: {
              properties: {
                content: {
                  type: 'string',
                },
              },
              type: 'object',
            },
            status: {
              properties: {
                attributes: {
                  properties: {
                    isSuccess: {
                      enum: [
                        'true',
                      ],
                      type: 'string',
                    },
                  },
                  required: [
                    'isSuccess',
                  ],
                  type: 'object',
                },
              },
              required: [
                'attributes',
              ],
              type: 'object',
            },
          },
          required: [
            'record',
            'status',
          ],
          type: 'object',
        },
      },
      required: [
        'readResponse',
      ],
      type: 'object',
    },
    {
      properties: {
        readResponse: {
          properties: {
            status: {
              properties: {
                attributes: {
                  properties: {
                    isSuccess: {
                      enum: [
                        'false',
                      ],
                      type: 'string',
                    },
                  },
                  required: [
                    'isSuccess',
                  ],
                  type: 'object',
                },
                statusDetail: {
                  items: [
                    {
                      properties: {
                        code: {
                          type: 'string',
                        },
                        message: {
                          type: 'string',
                        },
                      },
                      required: [
                        'code',
                        'message',
                      ],
                      type: 'object',
                    },
                  ],
                  maxItems: 1,
                  minItems: 1,
                  type: 'array',
                },
              },
              required: [
                'attributes',
                'statusDetail',
              ],
              type: 'object',
            },
          },
          required: [
            'status',
          ],
          type: 'object',
        },
      },
      required: [
        'readResponse',
      ],
      type: 'object',
    },
  ],
}

export const DEPLOY_LIST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  anyOf: [
    {
      properties: {
        writeResponseList: {
          properties: {
            status: {
              properties: {
                attributes: {
                  properties: {
                    isSuccess: {
                      enum: [
                        'true',
                      ],
                      type: 'string',
                    },
                  },
                  required: [
                    'isSuccess',
                  ],
                  type: 'object',
                },
              },
              required: [
                'attributes',
              ],
              type: 'object',
            },
            writeResponse: {
              items: {
                anyOf: [
                  {
                    properties: {
                      baseRef: {
                        properties: {
                          attributes: {
                            properties: {
                              internalId: {
                                type: 'string',
                              },
                            },
                            required: [
                              'internalId',
                            ],
                            type: 'object',
                          },
                        },
                        required: [
                          'attributes',
                        ],
                        type: 'object',
                      },
                      status: {
                        properties: {
                          attributes: {
                            properties: {
                              isSuccess: {
                                enum: [
                                  'true',
                                ],
                                type: 'string',
                              },
                            },
                            required: [
                              'isSuccess',
                            ],
                            type: 'object',
                          },
                        },
                        required: [
                          'attributes',
                        ],
                        type: 'object',
                      },
                    },
                    required: [
                      'baseRef',
                      'status',
                    ],
                    type: 'object',
                  },
                  {
                    properties: {
                      status: {
                        properties: {
                          attributes: {
                            properties: {
                              isSuccess: {
                                enum: [
                                  'false',
                                ],
                                type: 'string',
                              },
                            },
                            required: [
                              'isSuccess',
                            ],
                            type: 'object',
                          },
                          statusDetail: {
                            items: [
                              {
                                properties: {
                                  code: {
                                    type: 'string',
                                  },
                                  message: {
                                    type: 'string',
                                  },
                                },
                                required: [
                                  'code',
                                  'message',
                                ],
                                type: 'object',
                              },
                            ],
                            maxItems: 1,
                            minItems: 1,
                            type: 'array',
                          },
                        },
                        required: [
                          'attributes',
                          'statusDetail',
                        ],
                        type: 'object',
                      },
                    },
                    required: [
                      'status',
                    ],
                    type: 'object',
                  },
                ],
              },
              type: 'array',
            },
          },
          required: [
            'status',
            'writeResponse',
          ],
          type: 'object',
        },
      },
      required: [
        'writeResponseList',
      ],
      type: 'object',
    },
    {
      properties: {
        writeResponseList: {
          properties: {
            status: {
              properties: {
                attributes: {
                  properties: {
                    isSuccess: {
                      enum: [
                        'false',
                      ],
                      type: 'string',
                    },
                  },
                  required: [
                    'isSuccess',
                  ],
                  type: 'object',
                },
                statusDetail: {
                  items: [
                    {
                      properties: {
                        code: {
                          type: 'string',
                        },
                        message: {
                          type: 'string',
                        },
                      },
                      required: [
                        'code',
                        'message',
                      ],
                      type: 'object',
                    },
                  ],
                  maxItems: 1,
                  minItems: 1,
                  type: 'array',
                },
              },
              required: [
                'attributes',
                'statusDetail',
              ],
              type: 'object',
            },
          },
          required: [
            'status',
          ],
          type: 'object',
        },
      },
      required: [
        'writeResponseList',
      ],
      type: 'object',
    },
  ],
}

export const SEARCH_ERROR_SCHEMA = {
  properties: {
    searchResult: {
      properties: {
        status: {
          properties: {
            attributes: {
              properties: {
                isSuccess: {
                  enum: [
                    'false',
                  ],
                },
              },
              required: [
                'isSuccess',
              ],
              type: 'object',
            },
            statusDetail: {
              items: [
                {
                  protperties: {
                    code: {
                      type: 'string',
                    },
                    message: {
                      type: 'string',
                    },
                  },
                  required: [
                    'code',
                    'message',
                  ],
                  type: 'object',
                },
              ],
              maxItems: 1,
              minItems: 1,
              type: 'array',
            },
          },
          required: [
            'attributes',
            'statusDetail',
          ],
        },
      },
      required: [
        'status',
      ],
      type: 'object',
    },
  },
  required: [
    'searchResult',
  ],
  type: 'object',
}

const RECORD_DEFINITION = {
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        internalId: { type: 'string' },
      },
      required: ['internalId'],
    },
  },
  required: ['attributes'],
}

export const SEARCH_SUCCESS_SCHEMA = {
  definitions: {
    Record: RECORD_DEFINITION,
  },
  properties: {
    searchResult: {
      properties: {
        recordList: {
          properties: {
            record: {
              items: {
                $ref: '#/definitions/Record',
              },
              type: 'array',
            },
          },
          required: [
            'record',
          ],
          type: 'object',
          nullable: true,
        },
        searchId: {
          type: 'string',
        },
        totalPages: {
          type: 'number',
        },
      },
      required: [
        'recordList',
        'searchId',
        'totalPages',
      ],
      type: 'object',
    },
  },
  required: [
    'searchResult',
  ],
  type: 'object',
}

export const SEARCH_RESPONSE_SCHEMA = {
  anyOf: [
    {
      SEARCH_SUCCESS_SCHEMA,
    },
    {
      SEARCH_ERROR_SCHEMA,
    },
  ],
}

export const GET_ALL_RESPONSE_SCHEMA = {
  definitions: {
    Record: RECORD_DEFINITION,
  },
  properties: {
    getAllResult: {
      properties: {
        recordList: {
          properties: {
            record: {
              items: {
                $ref: '#/definitions/Record',
              },
              type: 'array',
            },
          },
          required: [
            'record',
          ],
          type: 'object',
        },
      },
      required: [
        'recordList',
      ],
      type: 'object',
    },
  },
  required: [
    'getAllResult',
  ],
  type: 'object',
}
