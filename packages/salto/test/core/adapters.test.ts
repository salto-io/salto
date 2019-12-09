import {
  InstanceElement, ObjectType, ElemID, Element,
} from 'adapter-api'
import { creator } from 'salesforce-adapter'
import initAdapters from '../../src/core/adapters/adapters'
import { Workspace, CREDS_DIR } from '../../src/workspace/workspace'
import { toAddFetchChange } from '../../src/core/fetch'
import { DetailedChange } from '../../src/core/plan'


describe('Test adapters.ts', () => {
  const createMockWorkspace = (
    elements: Readonly<Element[]>,
    addErrors = false
  ): Workspace => ({
    elements,
    updateBlueprints: jest.fn(),
    flush: jest.fn(),
    getWorkspaceErrors: () => (addErrors
      ? [{ severity: 'Error' }]
      : []),
  } as unknown as Workspace)

  const configToChange = (config: InstanceElement): DetailedChange => {
    config.path = [CREDS_DIR, config.elemID.adapter]
    return toAddFetchChange(config).change
  }

  const { configType } = creator

  const notConfigType = new ObjectType({ elemID: new ElemID('salesforce', 'not_config') })

  const bpConfig = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    {
      username: 'bpuser',
      password: 'bppass',
      token: 'bptoken',
      sandbox: false,
    }
  )

  const userConfig = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    {
      username: 'useruser',
      password: 'userpass',
      token: 'usertoken',
      sandbox: true,
    }
  )

  const RedHeringWrongAdapter = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID('err') }),
    {
      username: 'err',
      password: 'err',
      token: 'err',
      sandbox: true,
    }
  )

  const RedHeringNotConfig = new InstanceElement(
    'reg',
    notConfigType,
    {
      username: 'err',
      password: 'err',
      token: 'err',
      sandbox: true,
    }
  )

  const fillConfig = async (_ct: ObjectType): Promise<InstanceElement> => userConfig

  it('should return adapter when config is defined', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
      bpConfig,
    ]
    const workspace = createMockWorkspace(elements)
    const adapters = await initAdapters(
      workspace,
      fillConfig
    )
    expect(adapters.salesforce).toBeDefined()
    expect((workspace.updateBlueprints as jest.FunctionLike)).not.toHaveBeenCalled()
    expect((workspace.flush as jest.FunctionLike)).not.toHaveBeenCalled()
  })

  it('should prompt for config when no proper config exists and flush it', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
    ]
    const workspace = createMockWorkspace(elements)
    const adapters = await initAdapters(
      workspace,
      fillConfig
    )
    expect(adapters.salesforce).toBeDefined()
    expect((workspace.updateBlueprints as jest.FunctionLike))
      .toHaveBeenCalledWith(configToChange(userConfig))
    expect((workspace.flush as jest.FunctionLike)).toHaveBeenCalled()
  })

  it('should not flush when critical errors are created', async () => {
    const elements = [
      configType,
      RedHeringNotConfig,
      RedHeringWrongAdapter,
    ]
    const workspace = createMockWorkspace(elements, true)
    const adapters = await initAdapters(
      workspace,
      fillConfig
    )
    expect(adapters.salesforce).toBeDefined()
    expect((workspace.updateBlueprints as jest.FunctionLike))
      .toHaveBeenCalledWith(configToChange(userConfig))
    expect((workspace.flush as jest.FunctionLike)).not.toHaveBeenCalled()
  })
})
