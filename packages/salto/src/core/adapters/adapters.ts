import _ from 'lodash'
import {
  InstanceElement, ObjectType, isInstanceElement, Adapter, ElemIdGetter,
} from 'adapter-api'
import { promises } from '@salto/lowerdash'
import { logger } from '@salto/logging'
import adapterCreators from './creators'
import { toAddFetchChange } from '../fetch'
import { CREDS_DIR, Workspace } from '../../workspace/workspace'
import { DetailedChange } from '../plan'

const log = logger(module)

const persistNewConfigs = async (
  workspace: Workspace,
  newConfigs: InstanceElement[]
): Promise<void> => {
  const configToChange = (config: InstanceElement): DetailedChange => {
    config.path = [CREDS_DIR, config.elemID.adapter]
    return toAddFetchChange(config).change
  }
  await workspace.updateBlueprints(...newConfigs.map(configToChange))
  const criticalErrors = (await workspace.getWorkspaceErrors())
    .filter(e => e.severity === 'Error')
  if (criticalErrors.length > 0) {
    log.warn('can not persist new configs due to critical workspace errors.')
  } else {
    await workspace.flush()
    const newAdapters = newConfigs.map(config => config.elemID.adapter)
    log.debug(`persisted new configs for adapers: ${newAdapters.join(',')}`)
  }
}

const initAdapters = async (
  workspace: Workspace,
  fillConfig: (t: ObjectType) => Promise<InstanceElement>,
  getElemIdFunc?: ElemIdGetter):
  Promise<Record<string, Adapter>> => {
  const configs = workspace.elements.filter(isInstanceElement)
    .filter(e => e.elemID.isConfig())
  const newConfigs: InstanceElement[] = []

  const findConfig = async (configType: ObjectType): Promise<InstanceElement> => {
    let config = configs.find(e => e.elemID.adapter === configType.elemID.adapter)
    if (!config) {
      config = await fillConfig(configType)
      newConfigs.push(config)
    }
    return config
  }

  const adapterPromises: Record<string, Promise<Adapter>> = _.mapValues(
    adapterCreators, async creator => {
      const config = await findConfig(creator.configType)
      return creator.create({ config, getElemIdFunc })
    }
  )

  const adapters = await promises.object.resolveValues(adapterPromises)
  log.debug(`${Object.keys(adapters).length} adapters were initialized [newConfigs=${
    newConfigs.length}]`)
  if (newConfigs.length > 0) {
    await persistNewConfigs(workspace, newConfigs)
  }
  return adapters
}

export default initAdapters
