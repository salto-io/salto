/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  getChangeData,
  isEqualElements,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { FilterWith } from '../../src/filter_utils'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../src/client'
import { defaultDeployFilterCreator } from '../../src/filters/default_deploy'
import { createElementQuery } from '../../src/fetch/query'
import { noPagination } from '../../src/fetch/request/pagination'
import { ChangeAndContext } from '../../src/definitions/system/deploy'

describe('default deploy filter', () => {
  type FilterType = FilterWith<'deploy'>
  let filter: FilterType
  let deployChangeFunc: jest.MockedFunction<(args: ChangeAndContext) => Promise<void>>
  let client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface>

  beforeEach(async () => {
    jest.clearAllMocks()
    client = {
      get: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['get']>(),
      put: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['put']>(),
      patch: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['patch']>(),
      post: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['post']>(),
      delete: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['delete']>(),
      head: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['head']>(),
      options: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['options']>(),
      getPageSize: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['getPageSize']>(),
    }
    deployChangeFunc = jest.fn()
    filter = defaultDeployFilterCreator({
      convertError: (_elemID, err) => err,
      deployChangeFunc,
    })({
      definitions: {
        clients: {
          default: 'main',
          options: {
            main: {
              httpClient: client,
              endpoints: {
                default: {
                  get: {
                    readonly: true,
                  },
                },
                customizations: {},
              },
            },
          },
        },
        pagination: {
          none: {
            funcCreator: noPagination,
          },
        },
        deploy: {
          instances: {
            customizations: {
              myType: {
                requestsByAction: {
                  customizations: {
                    add: [],
                  },
                },
              },
            },
          },
        },
      },
      elementSource: buildElementsSourceFromElements([]),
      config: {},
      fetchQuery: createElementQuery({
        include: [{ type: 'something' }],
        exclude: [],
      }),
      sharedContext: {},
    }) as FilterType
  })

  describe('deploy', () => {
    // TODO extend tests
    it('should mark all changes as applied if no errors were encountered', async () => {
      deployChangeFunc.mockResolvedValue(Promise.resolve())
      const changes = [
        toChange({
          after: new InstanceElement('name1', new ObjectType({ elemID: new ElemID('myAdapter', 'myType') })),
        }),
        toChange({
          after: new InstanceElement('name2', new ObjectType({ elemID: new ElemID('myAdapter', 'myType') })),
        }),
      ]
      const res = await filter.deploy(changes, { changes, groupID: 'a' })
      expect(res.deployResult.appliedChanges).toHaveLength(changes.length)
      expect(
        res.deployResult.appliedChanges.every((change, idx) =>
          isEqualElements(getChangeData(change), getChangeData(changes[idx])),
        ),
      ).toBeTruthy()
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
    })

    it('should return errors for failed changes', async () => {
      deployChangeFunc
        .mockResolvedValueOnce(Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(Error('something bad happened')))
      const changes = [
        toChange({
          after: new InstanceElement('success', new ObjectType({ elemID: new ElemID('myAdapter', 'myType') })),
        }),
        toChange({
          after: new InstanceElement('failure', new ObjectType({ elemID: new ElemID('myAdapter', 'myType') })),
        }),
      ]
      const res = await filter.deploy(changes, { changes, groupID: 'a' })
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(isEqualElements(getChangeData(res.deployResult.appliedChanges[0]), getChangeData(changes[0]))).toBeTruthy()
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toEqual([
        {
          elemID: new ElemID('myAdapter', 'myType', 'instance', 'failure'),
          message: 'Error: something bad happened',
          detailedMessage: 'Error: something bad happened',
          severity: 'Error',
        },
      ])
    })

    it('should throw if deploy definitions are not found', async () => {
      await expect(() =>
        defaultDeployFilterCreator({
          convertError: (_elemID, err) => err,
          deployChangeFunc,
        })({
          definitions: {
            clients: {
              default: 'main',
              options: {
                main: {
                  httpClient: client,
                  endpoints: {
                    default: {
                      get: {
                        readonly: true,
                      },
                    },
                    customizations: {},
                  },
                },
              },
            },
            pagination: {
              none: {
                funcCreator: noPagination,
              },
            },
          },
          elementSource: buildElementsSourceFromElements([]),
          config: {},
          fetchQuery: createElementQuery({
            include: [{ type: 'something' }],
            exclude: [],
          }),
          sharedContext: {},
        }).deploy?.([]),
      ).rejects.toThrow('could not find deploy definitions')
    })
    it('should throw if change group is not provided', async () => {
      await expect(() => filter.deploy([])).rejects.toThrow('change group not provided')
    })

    it('should use a custom lookup function creator if provided', async () => {
      const lookupFunc = jest.fn()
      const lookupFuncCreator = jest.fn().mockReturnValue(lookupFunc)
      // Custom lookup is only called to resolve references when not using a
      // custom deploy function, so we provide an actual request in the
      // type's deploy definitions.
      filter = defaultDeployFilterCreator({
        convertError: (_elemID, err) => err,
        lookupFuncCreator,
      })({
        definitions: {
          clients: {
            default: 'main',
            options: {
              main: {
                httpClient: client,
                endpoints: {
                  default: {
                    get: {
                      readonly: true,
                    },
                  },
                  customizations: {},
                },
              },
            },
          },
          deploy: {
            instances: {
              customizations: {
                myType: {
                  requestsByAction: {
                    customizations: {
                      add: [
                        {
                          request: {
                            endpoint: {
                              path: 'http://example.com',
                              method: 'get',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        elementSource: buildElementsSourceFromElements([]),
      }) as FilterType
      const changes = [
        toChange({
          after: new InstanceElement('name1', new ObjectType({ elemID: new ElemID('myAdapter', 'myType') }), {
            refField: new ReferenceExpression(new ElemID('myAdapter', 'myType', 'instance', 'name2')),
          }),
        }),
        toChange({
          after: new InstanceElement('name2', new ObjectType({ elemID: new ElemID('myAdapter', 'myType') }), {
            refField1: new ReferenceExpression(new ElemID('myAdapter', 'myType', 'instance', 'name1')),
            refField2: new ReferenceExpression(new ElemID('myAdapter', 'myType', 'instance', 'name1')),
          }),
        }),
      ]
      const res = await filter.deploy(changes, { changes, groupID: 'a' })
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(changes.length)
      expect(
        res.deployResult.appliedChanges.every((change, idx) =>
          isEqualElements(getChangeData(change), getChangeData(changes[idx])),
        ),
      ).toBeTruthy()
      expect(res.leftoverChanges).toHaveLength(0)
      expect(lookupFuncCreator).toHaveBeenCalledTimes(1)
      // Should be called once for each reference expression.
      expect(lookupFunc).toHaveBeenCalledTimes(3)
    })
  })
})
