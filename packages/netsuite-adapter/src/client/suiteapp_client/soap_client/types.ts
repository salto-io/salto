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
export type GetSuccess = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      getResponse: {
        'platformMsgs:readResponse': {
          'platformCore:status': {
            _attributes: {
              isSuccess: 'true'
            }
          }
          'platformMsgs:record': {
            'docFileCab:content': {
              _text?: string
            }
          }
        }
      }
    }
  }
}

export type GetError = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      getResponse: {
        'platformMsgs:readResponse': {
          'platformCore:status': {
            _attributes: {
              isSuccess: 'false'
            }
            'platformCore:statusDetail': {
              'platformCore:code': {
                _text: string
              }
              'platformCore:message': {
                _text: string
              }
            }
          }
        }
      }
    }
  }
}

export type GetResult = GetSuccess | GetError

export const isGetSuccess = (result: GetResult): result is GetSuccess =>
  // eslint-disable-next-line no-underscore-dangle
  result['soapenv:Envelope']['soapenv:Body'].getResponse['platformMsgs:readResponse']['platformCore:status']._attributes.isSuccess === 'true'

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
