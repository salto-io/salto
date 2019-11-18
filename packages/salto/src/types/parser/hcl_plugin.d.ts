declare namespace NodeJS {
  interface Global {
    saltoGoHclParser: import('../../parser/internal/types').HclParser
  }
}