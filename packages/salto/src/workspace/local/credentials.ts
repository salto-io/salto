import path from 'path'
import { logger } from '@salto/logging'
import { InstanceElement } from 'adapter-api'
import { BP_EXTENSION, loadBlueprint } from '../blueprint'
import { parse } from '../../parser/parse'
import Credentials from '../credentials'
import { exists, mkdirp, replaceContents } from '../../file'
import { dump } from '../../parser/dump'

const log = logger(module)

export default class LocalCredentials implements Credentials {
  constructor(private credsDir: string) {}

  private filePath(adapter: string, absolute = true): string {
    const filename = adapter.concat(BP_EXTENSION)
    return absolute ? path.join(this.credsDir, filename) : filename
  }

  async get(adapter: string): Promise<InstanceElement | undefined> {
    if (!await exists(this.filePath(adapter))) {
      return Promise.resolve(undefined)
    }
    const bp = await loadBlueprint(this.filePath(adapter, false), this.credsDir)
    return parse(Buffer.from(bp.buffer), bp.filename).elements.pop() as InstanceElement
  }

  async set(adapter: string, credentials: InstanceElement): Promise<void> {
    if (!await exists(this.credsDir)) {
      await mkdirp(this.credsDir)
    }
    await replaceContents(this.filePath(adapter), dump([credentials]))
    log.info('set credentials for %s', adapter)
  }
}
