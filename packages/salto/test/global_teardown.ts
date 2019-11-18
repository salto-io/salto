import { stopParser } from '../src/parser/internal/hcl'

module.exports = async () => {
  await stopParser()
}
