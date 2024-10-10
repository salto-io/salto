/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  AdditionChange,
  CORE_ANNOTATIONS,
  ChangeGroup,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  RemovalChange,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../src/constants'

export const objectTypeMock = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'testType'),
})

export const instanceElementMock = new InstanceElement('testInstance', objectTypeMock, {
  testField: 'testValue',
})

export const instanceElementWithParentMock = new InstanceElement(
  'testInstanceChild',
  objectTypeMock,
  {
    testField: 'testValueChild',
  },
  undefined,
  {
    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(instanceElementMock.elemID),
  },
)

export const additionChangeMock: AdditionChange<InstanceElement> = {
  action: 'add',
  data: {
    after: instanceElementMock,
  },
}

export const modificationChangeMock: ModificationChange<InstanceElement> = {
  action: 'modify',
  data: {
    before: instanceElementMock,
    after: instanceElementWithParentMock,
  },
}

export const removalChangeMock: RemovalChange<InstanceElement> = {
  action: 'remove',
  data: {
    before: instanceElementMock,
  },
}

export const changeGroupMock: ChangeGroup = {
  groupID: 'testGroup',
  changes: [additionChangeMock],
}

export const mockElementSource = buildElementsSourceFromElements([objectTypeMock, instanceElementMock])

export const contextMock: definitions.deploy.ChangeAndExtendedContext & definitions.ContextParams = {
  additionalContext: { parent_id: 'parent_id' },
  change: additionChangeMock,
  changeGroup: changeGroupMock,
  elementSource: mockElementSource,
  sharedContext: {},
  errors: {},
}
