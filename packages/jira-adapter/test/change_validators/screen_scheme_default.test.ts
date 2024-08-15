/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { screenSchemeDefaultValidator } from '../../src/change_validators/screen_scheme_default'
import { JIRA, SCREEN_SCHEME_TYPE } from '../../src/constants'

describe('screenSchemeDefaultValidator', () => {
  let instance: InstanceElement

  beforeEach(() => {
    const type = new ObjectType({ elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE) })
    instance = new InstanceElement('instance', type, {
      screens: {
        default: '123',
      },
    })
  })
  it('should return an error if there is no default screen', async () => {
    delete instance.value.screens.default

    expect(
      await screenSchemeDefaultValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'ScreenScheme must include default screen',
        detailedMessage: 'ScreenScheme does not include a default screen',
      },
    ])
  })

  it('should return an error if there is no screens', async () => {
    delete instance.value.screens

    expect(
      await screenSchemeDefaultValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'ScreenScheme must include default screen',
        detailedMessage: 'ScreenScheme does not include a default screen',
      },
    ])
  })

  it('should not return an error if there is default screen', async () => {
    expect(
      await screenSchemeDefaultValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
})
