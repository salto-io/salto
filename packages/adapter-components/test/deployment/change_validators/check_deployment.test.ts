/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { TypeConfig } from '../../../src/config_deprecated/shared'
import { createCheckDeploymentBasedOnConfigValidator } from '../../../src/deployment/change_validators/check_deployment_based_on_config'

describe('checkDeploymentBasedOnConfigValidator', () => {
  let type: ObjectType
  const typesConfig: Record<string, TypeConfig> = {
    test: {
      deployRequests: {
        add: {
          url: '/test',
          method: 'post',
        },
      },
    },
  }
  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID('dum', 'test') })
  })

  it('should not return an error when the changed element is not an instance', async () => {
    const errors = await createCheckDeploymentBasedOnConfigValidator({ typesConfig })([toChange({ after: type })])
    expect(errors).toEqual([])
  })

  it('should return an error when type does not support deploy', async () => {
    const instance = new InstanceElement('test2', new ObjectType({ elemID: new ElemID('dum', 'test2') }))
    const errors = await createCheckDeploymentBasedOnConfigValidator({ typesConfig })([toChange({ after: instance })])
    expect(errors).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Operation not supported',
        detailedMessage: `Salto does not support "add" of ${instance.elemID.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })

  it('should return an error when type does not support specific method', async () => {
    const instance = new InstanceElement('test', type)
    const errors = await createCheckDeploymentBasedOnConfigValidator({ typesConfig })([toChange({ before: instance })])
    expect(errors).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Operation not supported',
        detailedMessage: `Salto does not support "remove" of ${instance.elemID.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })

  it('should not return an error when operation is supported', async () => {
    const instance = new InstanceElement('test', type)
    const errors = await createCheckDeploymentBasedOnConfigValidator({ typesConfig })([toChange({ after: instance })])
    expect(errors).toEqual([])
  })
  it('should not return an error when operation deployed via parent and parent is supported', async () => {
    const childTypeName = 'testChild'
    const parentInst = new InstanceElement('parent', type)
    const instance = new InstanceElement(
      'test',
      new ObjectType({ elemID: new ElemID('dum', childTypeName) }),
      undefined,
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentInst.elemID, parentInst)] },
    )
    const errors = await createCheckDeploymentBasedOnConfigValidator({
      typesConfig,
      typesDeployedViaParent: [childTypeName],
    })([toChange({ after: instance })])
    expect(errors).toEqual([])
  })
  it('should return an error when operation deployed via parent and parent is not supported', async () => {
    const childTypeName = 'testChild'
    const parentInst = new InstanceElement('parent', type)
    const instance = new InstanceElement(
      'test',
      new ObjectType({ elemID: new ElemID('dum', childTypeName) }),
      undefined,
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentInst.elemID, parentInst)] },
    )
    const errors = await createCheckDeploymentBasedOnConfigValidator({
      typesConfig,
      typesDeployedViaParent: [childTypeName],
    })([toChange({ before: instance })])
    expect(errors).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Operation not supported',
        detailedMessage: `Salto does not support "remove" of ${instance.elemID.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })
  it('should not return an error when operation deployed type in in the skipped list', async () => {
    const typeName = 'testChild'
    const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('dum', typeName) }))
    const errors = await createCheckDeploymentBasedOnConfigValidator({
      typesConfig,
      typesDeployedViaParent: [],
      typesWithNoDeploy: [typeName],
    })([toChange({ after: instance })])
    expect(errors).toEqual([])
  })
})
