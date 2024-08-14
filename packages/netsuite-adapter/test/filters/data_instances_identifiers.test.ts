/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_identifiers'
import { NETSUITE } from '../../src/constants'
import { IDENTIFIER_FIELD } from '../../src/data_elements/types'
import { LocalFilterOpts } from '../../src/filter'

describe('data_instances_identifiers', () => {
  it('should remove identifier field', async () => {
    const accountType = new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } })
    const accountInstance = new InstanceElement('instance', accountType, { [IDENTIFIER_FIELD]: 'someValue' })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: accountInstance })])
    expect(accountInstance.value[IDENTIFIER_FIELD]).toBeUndefined()
  })
})
