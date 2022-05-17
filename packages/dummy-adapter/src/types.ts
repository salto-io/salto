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
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ElemID, BuiltinTypes, DeployActions, DeployAction, ListType } from '@salto-io/adapter-api'

export type ChangeErrorFromConfigFile = {
  detailedMessage: string
  elemID: string
  message: string
  severity: string
  deployActions?: DeployActions
}

const deployActionRefType = createMatchingObjectType<DeployAction>({
  elemID: new ElemID('', 'deployAction'),
  fields: {
    title: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
      },
    },
    subActions: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
    documentationURL: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
      },
    },
  },
})

const deployActionsRefType = createMatchingObjectType<DeployActions>({
  elemID: new ElemID('', 'deployActions'),
  fields: {
    preAction: { refType: deployActionRefType },
    postAction: { refType: deployActionRefType },
  },
})


export const changeErrorRefType = createMatchingObjectType<ChangeErrorFromConfigFile>({
  elemID: new ElemID('', 'changeError'),
  fields: {
    detailedMessage: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    elemID: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    message: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    severity: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    deployActions: {
      refType: deployActionsRefType,
      annotations: {
        _required: false,
      },
    },
  },
})
