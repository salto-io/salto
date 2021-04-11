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

// The schemas here were generated automatically using https://github.com/YousefED/typescript-json-schema

export const GET_RESULTS_SCHEMA = {
  anyOf: [
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                getResponse: {
                  properties: {
                    'platformMsgs:readResponse': {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            '_attributes',
                          ],
                          type: 'object',
                        },
                        'platformMsgs:record': {
                          properties: {
                            'docFileCab:content': {
                              properties: {
                                _text: {
                                  type: 'string',
                                },
                              },
                              type: 'object',
                            },
                          },
                          required: [
                            'docFileCab:content',
                          ],
                          type: 'object',
                        },
                      },
                      required: [
                        'platformCore:status',
                        'platformMsgs:record',
                      ],
                      type: 'object',
                    },
                  },
                  required: [
                    'platformMsgs:readResponse',
                  ],
                  type: 'object',
                },
              },
              required: [
                'getResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                getResponse: {
                  properties: {
                    'platformMsgs:readResponse': {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            'platformCore:statusDetail': {
                              properties: {
                                'platformCore:code': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:message': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:code',
                                'platformCore:message',
                              ],
                              type: 'object',
                            },
                          },
                          required: [
                            '_attributes',
                            'platformCore:statusDetail',
                          ],
                          type: 'object',
                        },
                      },
                      required: [
                        'platformCore:status',
                      ],
                      type: 'object',
                    },
                  },
                  required: [
                    'platformMsgs:readResponse',
                  ],
                  type: 'object',
                },
              },
              required: [
                'getResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
  ],
}

export const UPDATE_LIST_SCHEMA = {
  anyOf: [
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                updateListResponse: {
                  properties: {
                    writeResponseList: {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            '_attributes',
                          ],
                          type: 'object',
                        },
                        writeResponse: {
                          anyOf: [
                            {
                              properties: {
                                baseRef: {
                                  properties: {
                                    _attributes: {
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
                                    '_attributes',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:status': {
                                  properties: {
                                    _attributes: {
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
                                    '_attributes',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'baseRef',
                                'platformCore:status',
                              ],
                              type: 'object',
                            },
                            {
                              properties: {
                                'platformCore:status': {
                                  properties: {
                                    _attributes: {
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
                                    'platformCore:statusDetail': {
                                      properties: {
                                        'platformCore:code': {
                                          properties: {
                                            _text: {
                                              type: 'string',
                                            },
                                          },
                                          required: [
                                            '_text',
                                          ],
                                          type: 'object',
                                        },
                                        'platformCore:message': {
                                          properties: {
                                            _text: {
                                              type: 'string',
                                            },
                                          },
                                          required: [
                                            '_text',
                                          ],
                                          type: 'object',
                                        },
                                      },
                                      required: [
                                        'platformCore:code',
                                        'platformCore:message',
                                      ],
                                      type: 'object',
                                    },
                                  },
                                  required: [
                                    '_attributes',
                                    'platformCore:statusDetail',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:status',
                              ],
                              type: 'object',
                            },
                            {
                              items: {
                                anyOf: [
                                  {
                                    properties: {
                                      baseRef: {
                                        properties: {
                                          _attributes: {
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
                                          '_attributes',
                                        ],
                                        type: 'object',
                                      },
                                      'platformCore:status': {
                                        properties: {
                                          _attributes: {
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
                                          '_attributes',
                                        ],
                                        type: 'object',
                                      },
                                    },
                                    required: [
                                      'baseRef',
                                      'platformCore:status',
                                    ],
                                    type: 'object',
                                  },
                                  {
                                    properties: {
                                      'platformCore:status': {
                                        properties: {
                                          _attributes: {
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
                                          'platformCore:statusDetail': {
                                            properties: {
                                              'platformCore:code': {
                                                properties: {
                                                  _text: {
                                                    type: 'string',
                                                  },
                                                },
                                                required: [
                                                  '_text',
                                                ],
                                                type: 'object',
                                              },
                                              'platformCore:message': {
                                                properties: {
                                                  _text: {
                                                    type: 'string',
                                                  },
                                                },
                                                required: [
                                                  '_text',
                                                ],
                                                type: 'object',
                                              },
                                            },
                                            required: [
                                              'platformCore:code',
                                              'platformCore:message',
                                            ],
                                            type: 'object',
                                          },
                                        },
                                        required: [
                                          '_attributes',
                                          'platformCore:statusDetail',
                                        ],
                                        type: 'object',
                                      },
                                    },
                                    required: [
                                      'platformCore:status',
                                    ],
                                    type: 'object',
                                  },
                                ],
                              },
                              type: 'array',
                            },
                          ],
                        },
                      },
                      required: [
                        'platformCore:status',
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
              },
              required: [
                'updateListResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                updateListResponse: {
                  properties: {
                    writeResponseList: {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            'platformCore:statusDetail': {
                              properties: {
                                'platformCore:code': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:message': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:code',
                                'platformCore:message',
                              ],
                              type: 'object',
                            },
                          },
                          required: [
                            '_attributes',
                            'platformCore:statusDetail',
                          ],
                          type: 'object',
                        },
                      },
                      required: [
                        'platformCore:status',
                      ],
                      type: 'object',
                    },
                  },
                  required: [
                    'writeResponseList',
                  ],
                  type: 'object',
                },
              },
              required: [
                'updateListResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
  ],
}

export const ADD_LIST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  anyOf: [
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                addListResponse: {
                  properties: {
                    writeResponseList: {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            '_attributes',
                          ],
                          type: 'object',
                        },
                        writeResponse: {
                          anyOf: [
                            {
                              properties: {
                                baseRef: {
                                  properties: {
                                    _attributes: {
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
                                    '_attributes',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:status': {
                                  properties: {
                                    _attributes: {
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
                                    '_attributes',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'baseRef',
                                'platformCore:status',
                              ],
                              type: 'object',
                            },
                            {
                              properties: {
                                'platformCore:status': {
                                  properties: {
                                    _attributes: {
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
                                    'platformCore:statusDetail': {
                                      properties: {
                                        'platformCore:code': {
                                          properties: {
                                            _text: {
                                              type: 'string',
                                            },
                                          },
                                          required: [
                                            '_text',
                                          ],
                                          type: 'object',
                                        },
                                        'platformCore:message': {
                                          properties: {
                                            _text: {
                                              type: 'string',
                                            },
                                          },
                                          required: [
                                            '_text',
                                          ],
                                          type: 'object',
                                        },
                                      },
                                      required: [
                                        'platformCore:code',
                                        'platformCore:message',
                                      ],
                                      type: 'object',
                                    },
                                  },
                                  required: [
                                    '_attributes',
                                    'platformCore:statusDetail',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:status',
                              ],
                              type: 'object',
                            },
                            {
                              items: {
                                anyOf: [
                                  {
                                    properties: {
                                      baseRef: {
                                        properties: {
                                          _attributes: {
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
                                          '_attributes',
                                        ],
                                        type: 'object',
                                      },
                                      'platformCore:status': {
                                        properties: {
                                          _attributes: {
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
                                          '_attributes',
                                        ],
                                        type: 'object',
                                      },
                                    },
                                    required: [
                                      'baseRef',
                                      'platformCore:status',
                                    ],
                                    type: 'object',
                                  },
                                  {
                                    properties: {
                                      'platformCore:status': {
                                        properties: {
                                          _attributes: {
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
                                          'platformCore:statusDetail': {
                                            properties: {
                                              'platformCore:code': {
                                                properties: {
                                                  _text: {
                                                    type: 'string',
                                                  },
                                                },
                                                required: [
                                                  '_text',
                                                ],
                                                type: 'object',
                                              },
                                              'platformCore:message': {
                                                properties: {
                                                  _text: {
                                                    type: 'string',
                                                  },
                                                },
                                                required: [
                                                  '_text',
                                                ],
                                                type: 'object',
                                              },
                                            },
                                            required: [
                                              'platformCore:code',
                                              'platformCore:message',
                                            ],
                                            type: 'object',
                                          },
                                        },
                                        required: [
                                          '_attributes',
                                          'platformCore:statusDetail',
                                        ],
                                        type: 'object',
                                      },
                                    },
                                    required: [
                                      'platformCore:status',
                                    ],
                                    type: 'object',
                                  },
                                ],
                              },
                              type: 'array',
                            },
                          ],
                        },
                      },
                      required: [
                        'platformCore:status',
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
              },
              required: [
                'addListResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                addListResponse: {
                  properties: {
                    writeResponseList: {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            'platformCore:statusDetail': {
                              properties: {
                                'platformCore:code': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:message': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:code',
                                'platformCore:message',
                              ],
                              type: 'object',
                            },
                          },
                          required: [
                            '_attributes',
                            'platformCore:statusDetail',
                          ],
                          type: 'object',
                        },
                      },
                      required: [
                        'platformCore:status',
                      ],
                      type: 'object',
                    },
                  },
                  required: [
                    'writeResponseList',
                  ],
                  type: 'object',
                },
              },
              required: [
                'addListResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
  ],
}

export const DELETE_LIST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  anyOf: [
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                deleteListResponse: {
                  properties: {
                    writeResponseList: {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            '_attributes',
                          ],
                          type: 'object',
                        },
                        writeResponse: {
                          anyOf: [
                            {
                              properties: {
                                baseRef: {
                                  properties: {
                                    _attributes: {
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
                                    '_attributes',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:status': {
                                  properties: {
                                    _attributes: {
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
                                    '_attributes',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'baseRef',
                                'platformCore:status',
                              ],
                              type: 'object',
                            },
                            {
                              properties: {
                                'platformCore:status': {
                                  properties: {
                                    _attributes: {
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
                                    'platformCore:statusDetail': {
                                      properties: {
                                        'platformCore:code': {
                                          properties: {
                                            _text: {
                                              type: 'string',
                                            },
                                          },
                                          required: [
                                            '_text',
                                          ],
                                          type: 'object',
                                        },
                                        'platformCore:message': {
                                          properties: {
                                            _text: {
                                              type: 'string',
                                            },
                                          },
                                          required: [
                                            '_text',
                                          ],
                                          type: 'object',
                                        },
                                      },
                                      required: [
                                        'platformCore:code',
                                        'platformCore:message',
                                      ],
                                      type: 'object',
                                    },
                                  },
                                  required: [
                                    '_attributes',
                                    'platformCore:statusDetail',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:status',
                              ],
                              type: 'object',
                            },
                            {
                              items: {
                                anyOf: [
                                  {
                                    properties: {
                                      baseRef: {
                                        properties: {
                                          _attributes: {
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
                                          '_attributes',
                                        ],
                                        type: 'object',
                                      },
                                      'platformCore:status': {
                                        properties: {
                                          _attributes: {
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
                                          '_attributes',
                                        ],
                                        type: 'object',
                                      },
                                    },
                                    required: [
                                      'baseRef',
                                      'platformCore:status',
                                    ],
                                    type: 'object',
                                  },
                                  {
                                    properties: {
                                      'platformCore:status': {
                                        properties: {
                                          _attributes: {
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
                                          'platformCore:statusDetail': {
                                            properties: {
                                              'platformCore:code': {
                                                properties: {
                                                  _text: {
                                                    type: 'string',
                                                  },
                                                },
                                                required: [
                                                  '_text',
                                                ],
                                                type: 'object',
                                              },
                                              'platformCore:message': {
                                                properties: {
                                                  _text: {
                                                    type: 'string',
                                                  },
                                                },
                                                required: [
                                                  '_text',
                                                ],
                                                type: 'object',
                                              },
                                            },
                                            required: [
                                              'platformCore:code',
                                              'platformCore:message',
                                            ],
                                            type: 'object',
                                          },
                                        },
                                        required: [
                                          '_attributes',
                                          'platformCore:statusDetail',
                                        ],
                                        type: 'object',
                                      },
                                    },
                                    required: [
                                      'platformCore:status',
                                    ],
                                    type: 'object',
                                  },
                                ],
                              },
                              type: 'array',
                            },
                          ],
                        },
                      },
                      required: [
                        'platformCore:status',
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
              },
              required: [
                'deleteListResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
    {
      properties: {
        'soapenv:Envelope': {
          properties: {
            'soapenv:Body': {
              properties: {
                deleteListResponse: {
                  properties: {
                    writeResponseList: {
                      properties: {
                        'platformCore:status': {
                          properties: {
                            _attributes: {
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
                            'platformCore:statusDetail': {
                              properties: {
                                'platformCore:code': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                                'platformCore:message': {
                                  properties: {
                                    _text: {
                                      type: 'string',
                                    },
                                  },
                                  required: [
                                    '_text',
                                  ],
                                  type: 'object',
                                },
                              },
                              required: [
                                'platformCore:code',
                                'platformCore:message',
                              ],
                              type: 'object',
                            },
                          },
                          required: [
                            '_attributes',
                            'platformCore:statusDetail',
                          ],
                          type: 'object',
                        },
                      },
                      required: [
                        'platformCore:status',
                      ],
                      type: 'object',
                    },
                  },
                  required: [
                    'writeResponseList',
                  ],
                  type: 'object',
                },
              },
              required: [
                'deleteListResponse',
              ],
              type: 'object',
            },
          },
          required: [
            'soapenv:Body',
          ],
          type: 'object',
        },
      },
      required: [
        'soapenv:Envelope',
      ],
      type: 'object',
    },
  ],
}
