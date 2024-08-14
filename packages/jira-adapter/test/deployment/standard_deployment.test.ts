/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, SaltoError, toChange } from '@salto-io/adapter-api'
import { deployChanges } from '../../src/deployment/standard_deployment'
import { JIRA } from '../../src/constants'

describe('deployChanges', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, 'type'),
    })
    instance = new InstanceElement('instance', type)
  })
  it('should return salto element errors when failed', async () => {
    const res = await deployChanges([toChange({ after: instance })], () => {
      throw new Error('failed')
    })
    expect(res.appliedChanges).toHaveLength(0)
    expect(res.errors).toEqual([
      {
        message: 'Error: failed',
        severity: 'Error',
        elemID: instance.elemID,
      },
    ])
  })

  it('should return the applied change and an error when the error severity is not Error', async () => {
    const warningError: SaltoError = {
      message: 'warning message',
      severity: 'Warning',
    }
    const res = await deployChanges([toChange({ after: instance })], () => {
      throw warningError
    })
    expect(res.appliedChanges).toHaveLength(1)
    expect(res.appliedChanges[0]).toEqual(toChange({ after: instance }))
    expect(res.errors).toEqual([
      {
        message: 'warning message',
        severity: 'Warning',
        elemID: instance.elemID,
      },
    ])
  })
})
