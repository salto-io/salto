import { dynamoDbRepo } from '@salto/persistent-pool'
import adapters from '../adapters'
import argparser from './argparser'
import { writeLine } from './stream'

const { stdout, stderr, exit, argv } = process

const repo = (tableName: string): ReturnType<typeof dynamoDbRepo> => dynamoDbRepo({
  clientId: 'e2e-credentials-store',
  tableName,
  serviceOpts: { region: 'eu-west-1' },
})

const main = async (): Promise<number> => {
  const parser = argparser({
    stdout,
    stderr,
    adapters,
    repo,
  })

  return parser(argv.slice(2))
}

main().then(code => exit(code), e => {
  writeLine(stderr, e.stack || e)
  process.exit(2)
})
