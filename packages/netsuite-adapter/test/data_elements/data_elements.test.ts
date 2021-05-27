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
import { ElemID, ObjectType } from '@salto-io/adapter-api'
import * as soap from 'soap'
import Bottleneck from 'bottleneck'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'
import SdfClient from '../../src/client/sdf_client'
import { getDataTypes } from '../../src/data_elements/data_elements'

jest.mock('@salto-io/adapter-components', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-components'),
  elements: {
    ...jest.requireActual('@salto-io/adapter-components').elements,
    soap: {
      extractTypes: jest.fn(),
    },
  },
}))

describe('getDataTypes', () => {
  const createClientMock = jest.spyOn(soap, 'createClientAsync')
  const extractTypesMock = elementsComponents.soap.extractTypes as jest.Mock
  const wsdl = {}

  const creds = {
    accountId: 'accountId',
    tokenId: 'tokenId',
    tokenSecret: 'tokenSecret',
    suiteAppTokenId: 'suiteAppTokenId',
    suiteAppTokenSecret: 'suiteAppTokenSecret',
  }
  const client = new NetsuiteClient(
    new SdfClient({ credentials: creds, globalLimiter: new Bottleneck() }),
    new SuiteAppClient({ credentials: creds, globalLimiter: new Bottleneck() }),
  )

  beforeEach(() => {
    jest.resetAllMocks()
    createClientMock.mockResolvedValue({ wsdl, addSoapHeader: jest.fn() } as unknown as soap.Client)
  })

  it('should return all the types', async () => {
    const typeA = new ObjectType({ elemID: new ElemID(NETSUITE, 'A') })
    const typeB = new ObjectType({ elemID: new ElemID(NETSUITE, 'Subsidiary'), fields: { A: { refType: typeA } } })
    const typeC = new ObjectType({ elemID: new ElemID(NETSUITE, 'C') })


    extractTypesMock.mockResolvedValue([typeA, typeB, typeC])

    const types = await getDataTypes(client)
    expect(types.map(t => t.elemID.name)).toEqual(['A', 'Subsidiary', 'C'])
  })

  it('should do nothing if SuiteApp is not configured ', async () => {
    jest.spyOn(client, 'isSuiteAppConfigured').mockReturnValue(false)
    const types = await getDataTypes(client)
    expect(types).toHaveLength(0)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('should return empty list if failed to get wsdl', async () => {
    jest.spyOn(client, 'getNetsuiteWsdl').mockResolvedValue(undefined)
    const types = await getDataTypes(client)
    expect(types).toHaveLength(0)
  })
})
