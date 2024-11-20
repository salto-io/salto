/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { createCheckDeploymentBasedOnDefinitionsValidator } from '../../../src/deployment/change_validators'
import { DeployApiDefinitions } from '../../../src/definitions/system/deploy'
import { TypeConfig } from '../../../src/config_deprecated'

describe('checkDeploymentBasedOnDefinitionsValidator', () => {
  let type: ObjectType
  let deployDefinitions: DeployApiDefinitions<never, never>
  let typesConfig: Record<string, TypeConfig> | undefined

  beforeEach(() => {
    deployDefinitions = {
      instances: {
        customizations: {
          coveredByDefinitions: {
            requestsByAction: {
              customizations: {
                add: [
                  {
                    request: {
                      endpoint: {
                        path: '/test',
                        method: 'post',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      dependencies: [],
    }
  })

  describe.each([[true, 'coveredByDefinitions'], [true, 'coveredByConfig'], [false, 'coveredByDefinitions']])('with type config = %s, type name = %s', (includeTypeConfig, typeName) => {
    beforeEach(() => {
      typesConfig = includeTypeConfig ? {
        // This type will be ignored because it's covered by the deploy definitions
        coveredByDefinitions: {
          deployRequests: {
            add: {
              url: '/shouldnthappen',
                method: 'delete',
            },
          },
        },
        coveredByConfig: {
          deployRequests: {
            add: {
              url: '/test',
              method: 'post',
            },
          },
        }
      } : undefined
      type = new ObjectType({ elemID: new ElemID('dum', typeName) })
    })
    it('should not return an error when the changed element is not an instance', async () => {
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions, typesConfig })([
        toChange({ after: type }),
      ])
      expect(errors).toEqual([])
    })

    it('should return an error when type does not support deploy', async () => {
      const instance = new InstanceElement('test2', new ObjectType({ elemID: new ElemID('dum', 'test2') }))
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions, typesConfig })([
        toChange({ after: instance }),
      ])
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
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions, typesConfig })([
        toChange({ before: instance }),
      ])
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
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions, typesConfig })([
        toChange({ after: instance }),
      ])
      expect(errors).toEqual([])
    })
    it('should not return an error when operation has an early success', async () => {
      const instance = new InstanceElement('test', type)
      _.set(deployDefinitions.instances, 'customizations.test.requestsByAction.customizations.add', [
        { request: { earlySuccess: true } },
      ])
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions, typesConfig })([
        toChange({ after: instance }),
      ])
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
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({
        deployDefinitions,
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
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({
        deployDefinitions,
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
      const childTypeName = 'testChild'
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('dum', childTypeName) }))
      const errors = await createCheckDeploymentBasedOnDefinitionsValidator({
        deployDefinitions,
        typesConfig,
        typesDeployedViaParent: [],
        typesWithNoDeploy: [childTypeName],
      })([toChange({ after: instance })])
      expect(errors).toEqual([])
    })
  })
})
