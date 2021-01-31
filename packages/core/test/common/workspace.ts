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
import { BuiltinTypes, Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import * as workspace from '@salto-io/workspace'
import { elementSource } from '@salto-io/workspace'
import { mockState } from './state'

const mockService = 'salto'
const emptyMockService = 'salto2'

export const SERVICES = [mockService, emptyMockService]

export const configID = new ElemID(mockService)
export const emptyConfigID = new ElemID(emptyMockService)
export const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    password: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    token: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    sandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  },
})

export const mockEmptyConfigType = new ObjectType({
  elemID: emptyConfigID,
  fields: {
    username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    password: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    token: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    sandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  },
})

export const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})

const mockEmptyConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockEmptyConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})

export const mockWorkspace = ({
  elements = [],
  name = undefined,
  index = [],
  stateElements = undefined,
  services = SERVICES,
}: {
  elements?: Element[]
  name?: string
  index?: workspace.remoteMap.RemoteMapEntry<workspace.pathIndex.Path[]>[]
  stateElements?: Element[]
  services?: string[]
}): workspace.Workspace => {
  const state = mockState(SERVICES, stateElements || elements, index)
  return {
    elements: jest.fn().mockImplementation(
      async () => elementSource.createInMemoryElementSource(elements)
    ),
    name,
    envs: () => ['default'],
    currentEnv: () => 'default',
    services: () => services,
    state: jest.fn().mockReturnValue(state),
    updateNaclFiles: jest.fn(),
    flush: jest.fn(),
    servicesCredentials: jest.fn().mockResolvedValue({
      [mockService]: mockConfigInstance,
      [emptyMockService]: mockEmptyConfigInstance,
    }),
    serviceConfig: jest.fn().mockResolvedValue(undefined),
    getWorkspaceErrors: jest.fn().mockResolvedValue([]),
    addService: jest.fn(),
    updateServiceCredentials: jest.fn(),
    updateServiceConfig: jest.fn(),
    clear: jest.fn(),
  } as unknown as workspace.Workspace
}
