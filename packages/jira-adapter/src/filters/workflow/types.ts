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

type Id = {
  name?: string
  entityId?: string
}

type ConfigRef = {
  id?: string
  name?: string
}

type ValidatorConfiguration = {
  windowsDays?: number | string
  fieldId?: string
  parentStatuses?: ConfigRef[]
  previousStatus?: ConfigRef
  field?: string
  fields?: string[]
  fieldIds?: string[]
}

type PostFunctionConfiguration = {
  projectRole?: ConfigRef
  event?: ConfigRef
}


export type Validator = {
  configuration?: ValidatorConfiguration
}


type PostFunction = {
  type?: string
  configuration?: PostFunctionConfiguration
}

export type Rules = {
  validators?: Validator[]
  postFunctions?: PostFunction[]
  conditionsTree?: unknown
  conditions?: unknown
}
type Transitions = {
  type?: string
  rules?: Rules
}

export type Status = {
  properties?: Values
}

export type Workflow = {
  id?: Id
  entityId?: string
  name?: string
  transitions?: Transitions[]
  statuses?: Status[]
}

// Was generated with https://github.com/YousefED/typescript-json-schema
export const WORKFLOW_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: {
    Values: {
      additionalProperties: {
      },
      type: 'object',
    },
  },
  properties: {
    entityId: {
      type: 'string',
    },
    id: {
      properties: {
        entityId: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
      },
      type: 'object',
    },
    name: {
      type: 'string',
    },
    statuses: {
      items: {
        properties: {
          properties: {
            $ref: '#/definitions/Values',
          },
        },
        type: 'object',
      },
      type: 'array',
    },
    transitions: {
      items: {
        properties: {
          rules: {
            properties: {
              conditions: {
              },
              conditionsTree: {
              },
              postFunctions: {
                items: {
                  properties: {
                    configuration: {
                      properties: {
                        event: {
                          properties: {
                            id: {
                              type: 'string',
                            },
                            name: {
                              type: 'string',
                            },
                          },
                          type: 'object',
                        },
                        projectRole: {
                          properties: {
                            id: {
                              type: 'string',
                            },
                            name: {
                              type: 'string',
                            },
                          },
                          type: 'object',
                        },
                      },
                      type: 'object',
                    },
                    type: {
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                type: 'array',
              },
              validators: {
                items: {
                  properties: {
                    configuration: {
                      properties: {
                        field: {
                          type: 'string',
                        },
                        fieldId: {
                          type: 'string',
                        },
                        fieldIds: {
                          items: {
                            type: 'string',
                          },
                          type: 'array',
                        },
                        fields: {
                          items: {
                            type: 'string',
                          },
                          type: 'array',
                        },
                        parentStatuses: {
                          items: {
                            properties: {
                              id: {
                                type: 'string',
                              },
                              name: {
                                type: 'string',
                              },
                            },
                            type: 'object',
                          },
                          type: 'array',
                        },
                        previousStatus: {
                          properties: {
                            id: {
                              type: 'string',
                            },
                            name: {
                              type: 'string',
                            },
                          },
                          type: 'object',
                        },
                        windowsDays: {
                          type: [
                            'string',
                            'number',
                          ],
                        },
                      },
                      type: 'object',
                    },
                  },
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
          type: {
            type: 'string',
          },
        },
        type: 'object',
      },
      type: 'array',
    },
  },
  type: 'object',
}
