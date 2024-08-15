/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { restletType } from '../../src/autogen/types/standard_types/restlet'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/script'
import { emailcapturepluginType } from '../../src/autogen/types/standard_types/emailcaptureplugin'
import { plugintypeType } from '../../src/autogen/types/standard_types/plugintype'
import { INTERNAL_ID } from '../../src/constants'

describe('setScriptsUrls', () => {
  const client = {
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const restlet = restletType().type
  const emailcaptureplugin = emailcapturepluginType().type
  const plugintype = plugintypeType().type

  it('should set the right url', async () => {
    const elements = [
      new InstanceElement('A', restlet, { scriptid: 'someScriptID', [INTERNAL_ID]: '1' }),
      new InstanceElement('B', emailcaptureplugin, { scriptid: 'somePluginID', [INTERNAL_ID]: '2' }),
      new InstanceElement('C', plugintype, { scriptid: 'somePluginTypeID', [INTERNAL_ID]: '3' }),
    ]
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/scripting/script.nl?id=1',
    )
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/scripting/plugin.nl?id=2',
    )
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/scripting/plugintype.nl?scripttype=PLUGINTYPE&id=3',
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', restlet, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
