import { describe, expect, it } from 'vitest'
import { matchPageScheme } from '@/lib/api'

describe('matchPageScheme', () => {
  it('gives a protocol-relative URL the page scheme', () => {
    expect(matchPageScheme('//api.test/api', 'https:')).toBe('https://api.test/api')
    expect(matchPageScheme('//api.test/api', 'http:')).toBe('http://api.test/api')
  })

  it('upgrades http to https for a remote host on an https page', () => {
    expect(matchPageScheme('http://192.168.1.5:8000/api', 'https:')).toBe('https://192.168.1.5:8000/api')
  })

  it('leaves loopback hosts and http pages alone', () => {
    expect(matchPageScheme('http://localhost:8000/api', 'https:')).toBe('http://localhost:8000/api')
    expect(matchPageScheme('http://192.168.1.5:8000/api', 'http:')).toBe('http://192.168.1.5:8000/api')
    expect(matchPageScheme('https://api.test/api', 'http:')).toBe('https://api.test/api')
  })

  it('swaps a loopback API host for the page host on another device', () => {
    expect(matchPageScheme('http://localhost:8000/api', 'http:', '192.168.117.86')).toBe('http://192.168.117.86:8000/api')
    expect(matchPageScheme('http://localhost:8000/api', 'http:', 'localhost')).toBe('http://localhost:8000/api')
    expect(matchPageScheme('http://api.test:8000/api', 'http:', '192.168.117.86')).toBe('http://api.test:8000/api')
  })
})
