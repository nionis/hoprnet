import net from 'net'
import abortable, { AbortError } from 'abortable-iterator'

import type { Socket } from 'net'
import mafmt from 'mafmt'
import errCode from 'err-code'

import debug from 'debug'
const log = debug('hopr-core:transport')
const error = debug('hopr-core:transport:error')

import { socketToConn } from './socket-to-conn'

import AbortController from 'abort-controller'

// @ts-ignore
import handshake = require('it-handshake')

import myHandshake from './handshake'

// @ts-ignore
import libp2p = require('libp2p')

import { createListener, Listener } from './listener'
import { multiaddrToNetConfig } from './utils'
import { USE_WEBRTC, CODE_P2P, RELAY_CIRCUIT_TIMEOUT, USE_OWN_STUN_SERVERS, WEBRTC_TIMEOUT } from './constants'

import Multiaddr from 'multiaddr'
import PeerInfo from 'peer-info'
import PeerId from 'peer-id'

import pipe from 'it-pipe'

import Peer, { Instance as SimplePeerInstance } from 'simple-peer'

// @ts-ignore
import wrtc = require('wrtc')

import { pubKeyToPeerId } from '../../utils'
import { u8aEquals, u8aConcat } from '@hoprnet/hopr-utils'

import type {
  Connection,
  Upgrader,
  DialOptions,
  Registrar,
  Dialer,
  ConnHandler,
  Handler,
  Stream,
  MultiaddrConnection,
} from './types'

import chalk from 'chalk'

import bl from 'bl'
import pushable, { Pushable } from 'it-pushable'

const RELAY_REGISTER = '/hopr/relay-register/0.0.1'
const DELIVERY_REGISTER = '/hopr/delivery-register/0.0.1'
const WEBRTC = '/hopr/webrtc/0.0.1'

const OK = new TextEncoder().encode('OK')
const FAIL = new TextEncoder().encode('FAIL')

/**
 * @class TCP
 */
class TCP {
  get [Symbol.toStringTag]() {
    return 'TCP'
  }

  private _useWebRTC: boolean
  private _useOwnStunServers: boolean
  // ONLY FOR TESTING
  private _failIntentionallyOnWebRTC: boolean
  private _timeoutIntentionallyOnWebRTC?: Promise<void>
  // END ONLY FOR TESTING
  private _upgrader: Upgrader
  private _dialer: Dialer
  private _registrar: Registrar
  private _peerInfo: PeerInfo
  private _handle: (protocols: string[] | string, handler: (connection: Handler) => void) => void
  private relays?: PeerInfo[]
  private stunServers: { urls: string }[]

  private _encoder: TextEncoder
  private _decoder: TextDecoder

  private connHandler: ConnHandler

  constructor({
    upgrader,
    libp2p,
    bootstrapServers,
    useWebRTC,
    useOwnStunServers,
    failIntentionallyOnWebRTC,
    timeoutIntentionallyOnWebRTC,
  }: {
    upgrader: Upgrader
    libp2p: libp2p
    bootstrapServers?: PeerInfo[]
    useWebRTC?: boolean
    useOwnStunServers?: boolean
    failIntentionallyOnWebRTC?: boolean
    timeoutIntentionallyOnWebRTC?: Promise<void>
  }) {
    if (!upgrader) {
      throw new Error('An upgrader must be provided. See https://github.com/libp2p/interface-transport#upgrader.')
    }

    if (!libp2p) {
      throw new Error('Transport module needs access to libp2p.')
    }

    if (bootstrapServers !== undefined && bootstrapServers.length > 0) {
      this.relays = bootstrapServers.filter(
        (peerInfo: PeerInfo) => peerInfo !== undefined && !libp2p.peerInfo.id.isEqual(peerInfo.id)
      )

      this.stunServers = []
      for (let i = 0; i < this.relays.length; i++) {
        let urls = ''
        this.relays[i].multiaddrs.forEach((ma: Multiaddr) => {
          if (urls.length > 0) {
            urls += ', '
          }

          const opts = ma.toOptions()

          if (opts.family == 'ipv4') {
            urls += `stun:${opts.host}`
          } else if (opts.family == 'ipv6') {
            // WebRTC seems to have no support IPv6 addresses
            // urls += `stun:[0${opts.host}]`
          }
        })
        this.stunServers.push({ urls })
      }
    }

    this._timeoutIntentionallyOnWebRTC = timeoutIntentionallyOnWebRTC
    this._failIntentionallyOnWebRTC = failIntentionallyOnWebRTC || false
    this._useOwnStunServers = useOwnStunServers === undefined ? USE_OWN_STUN_SERVERS : useOwnStunServers
    this._useWebRTC = useWebRTC === undefined ? USE_WEBRTC : useWebRTC
    this._registrar = libp2p.registrar
    this._handle = libp2p.handle.bind(libp2p)
    this._dialer = libp2p.dialer
    this._peerInfo = libp2p.peerInfo
    this._upgrader = upgrader

    this._encoder = new TextEncoder()
    this._decoder = new TextDecoder()

    this._handle(RELAY_REGISTER, this.handleRelay.bind(this))
    this._handle(DELIVERY_REGISTER, this.handleDelivery.bind(this))
    this._handle(WEBRTC, this.handleWebRTC.bind(this))
  }

  private relayToConn({
    connection,
    stream,
    counterparty,
  }: {
    connection: Connection
    stream: Stream
    counterparty: PeerId
  }): MultiaddrConnection {
    const maConn: MultiaddrConnection = {
      ...stream,
      conn: stream,
      localAddr: Multiaddr(`/p2p/${this._peerInfo.id.toB58String()}`),
      remoteAddr: Multiaddr(`/p2p/${counterparty.toB58String()}`),
      close: async (err?: Error) => {
        if (err !== undefined) {
          error(err)
        }

        try {
          await connection.close()
        } catch (err) {
          error(err)
        }

        maConn.timeline.close = Date.now()
      },
      timeline: {
        open: Date.now(),
      },
    }

    return maConn
  }

  async handleDelivery({ stream, connection }: Handler) {
    let shaker = handshake(stream)

    let sender: PeerId

    const pubKeySender = (await shaker.read())?.slice()

    if (pubKeySender == null) {
      error(`Received empty message. Ignoring connection ...`)
      shaker.write(FAIL)
      shaker.rest()
      return
    }

    try {
      sender = await pubKeyToPeerId(pubKeySender)
    } catch (err) {
      error(`Could not decode sender peerId. Error was: ${err}`)
      shaker.write(FAIL)
      shaker.rest()
      return
    }

    shaker.write(OK)
    shaker.rest()

    let conn: Connection

    if (this._useWebRTC) {
      const sinkBuffer = pushable<Uint8Array>()
      const srcBuffer = pushable<Uint8Array>()

      const stream = myHandshake(shaker.stream, sinkBuffer, srcBuffer)

      const timeout = setTimeout(() => {
        srcBuffer.end()
        sinkBuffer.end()
      }, WEBRTC_TIMEOUT)

      try {
        pipe(shaker.stream, stream.webRtcStream)
        pipe(stream.webRtcStream, shaker.stream)

        console.log(`here after piping streams`)
        let socket = await this.handleWebRTC(srcBuffer, sinkBuffer)

        clearTimeout(timeout)
        srcBuffer.end()
        sinkBuffer.end()

        conn = await this._upgrader.upgradeInbound(
          socketToConn(socket, {
            remoteAddr: Multiaddr(`/p2p/${sender.toB58String()}`),
            localAddr: Multiaddr(`/p2p/${this._peerInfo.id.toB58String()}`),
          })
        )
      } catch {
        clearTimeout(timeout)
        srcBuffer.end()
        sinkBuffer.end()

        conn = await this._upgrader
          .upgradeInbound(
            this.relayToConn({
              stream: stream.relayStream,
              counterparty: sender,
              connection,
            })
          )
          .catch()
      }
    } else {
      const stream = myHandshake(shaker.stream, undefined, undefined)
      const relayConn = {
        stream: stream.relayStream,
        counterparty: sender,
        connection,
      }

      try {
        conn = await this._upgrader.upgradeInbound(this.relayToConn(relayConn))
      } catch (err) {
        error(err)
        return
      }
    }

    this.connHandler?.call(conn)
  }

  async handleRelay({ stream, connection }: Handler) {
    const shaker = handshake(stream)

    let counterparty: PeerId
    const pubKeySender = (await shaker.read())?.slice()

    if (pubKeySender == null) {
      log(
        `Received empty message from peer ${chalk.yellow(connection.remotePeer.toB58String())} during connection setup`
      )
      shaker.write(FAIL)
      return
    }

    try {
      counterparty = await pubKeyToPeerId(pubKeySender)
    } catch (err) {
      log(
        `Peer ${chalk.yellow(
          connection.remotePeer.toB58String()
        )} asked to establish relayed connection to invalid counterparty. Error was ${err}. Received message ${pubKeySender}`
      )
      shaker.write(FAIL)
      return
    }

    const abort = new AbortController()

    const timeout = setTimeout(() => abort.abort(), RELAY_CIRCUIT_TIMEOUT)

    let conn: Connection
    try {
      conn = this._registrar.getConnection(new PeerInfo(counterparty))

      if (!conn) {
        conn = await this._dialer.connectToPeer(new PeerInfo(counterparty), { signal: abort.signal })
      }
    } catch (err) {
      error(`Could not establish connection to ${counterparty.toB58String()}. Error was: ${err.message}`)
      clearTimeout(timeout)
      shaker.write(FAIL)
      shaker.rest()
      return
    }

    const { stream: deliveryStream } = await conn.newStream([DELIVERY_REGISTER])

    clearTimeout(timeout)

    const relayShaker = handshake(deliveryStream)

    relayShaker.write(connection.remotePeer.pubKey.marshal())

    let answer = (await relayShaker.read())?.slice()

    if (answer != null && u8aEquals(answer, OK)) {
      shaker.write(OK)

      shaker.rest()
      relayShaker.rest()

      pipe(shaker.stream, relayShaker.stream, shaker.stream)

      pipe(relayShaker.stream, shaker.stream, relayShaker.stream)
    } else {
      log(`Could not relay to peer ${counterparty.toB58String()} because we are unable to deliver packets.`)

      shaker.write(FAIL)

      shaker.rest()
      relayShaker.rest()
    }
  }

  handleWebRTC(srcBuffer: Pushable<Uint8Array>, sinkBuffer: Pushable<Uint8Array>): Promise<Socket> {
    return new Promise<Socket>(async (resolve) => {
      let channel: SimplePeerInstance
      if (this._useOwnStunServers) {
        channel = new Peer({ wrtc, trickle: true, config: { iceServers: this.stunServers } })
      } else {
        channel = new Peer({ wrtc, trickle: true })
      }

      const done = async (err?: Error) => {
        channel.removeListener('connect', onConnect)
        channel.removeListener('error', onError)
        channel.removeListener('signal', onSignal)

        if (this._timeoutIntentionallyOnWebRTC !== undefined) {
          await this._timeoutIntentionallyOnWebRTC
        } else {
          if (!err && !this._failIntentionallyOnWebRTC) {
            setImmediate(resolve, (channel as unknown) as Socket)
          }
        }
      }

      const onSignal = (msg: string) => {
        console.log('sending', msg)
        sinkBuffer.push(this._encoder.encode(JSON.stringify(msg)))
      }

      const onConnect = async () => {
        log(`WebRTC counterparty connection established`)
        done()
      }

      const onError = (err?: Error) => {
        done(err)
      }

      channel.on('signal', onSignal)
      channel.once('connect', onConnect)
      channel.once('error', onConnect)

      await pipe(
        /* prettier-ignore */
        srcBuffer,
        async (source: AsyncIterable<Uint8Array>) => {
          for await (const msg of source) {
            console.log('receiving', msg)
            if (msg != null) {
              channel.signal(JSON.parse(this._decoder.decode(msg.slice())))
            }
          }
        }
      )
    })
  }

  /**
   * @async
   * @param {Multiaddr} ma
   * @param {object} options
   * @param {AbortSignal} options.signal Used to abort dial requests
   * @returns {Connection} An upgraded Connection
   */
  async dial(ma: Multiaddr, options?: DialOptions): Promise<Connection> {
    options = options || {}

    let error: Error
    if (['ip4', 'ip6', 'dns4', 'dns6'].includes(ma.protoNames()[0])) {
      try {
        return await this.dialDirectly(ma, options)
      } catch (err) {
        if (err.type === 'aborted') {
          throw err
        }
        error = err
      }
    }

    if (this.relays === undefined) {
      throw Error(
        `Could not connect ${chalk.yellow(ma.toString())} because there was no relay defined.${
          error != null ? ` Connection error was:\n${error}` : ''
        }`
      )
    }

    const destination = PeerId.createFromCID(ma.getPeerId())

    // Check whether we know some relays that we can use
    const potentialRelays = this.relays?.filter((peerInfo: PeerInfo) => !peerInfo.id.isEqual(destination))

    if (potentialRelays == null || potentialRelays.length == 0) {
      throw Error(
        `Destination ${chalk.yellow(
          ma.toString()
        )} cannot be accessed and directly and there is no other relay node known.${
          error != null ? ` Connection error was:\n${error}` : ''
        }`
      )
    }

    return await this.dialWithRelay(ma, potentialRelays, options)
  }

  tryWebRTC(
    srcBuffer: Pushable<Uint8Array>,
    sinkBuffer: Pushable<Uint8Array>,
    counterparty: PeerId,
    options?: { signal: AbortSignal }
  ): Promise<Socket> {
    log(`Trying WebRTC with peer ${counterparty.toB58String()}`)

    if (options.signal?.aborted) {
      throw new AbortError()
    }

    return new Promise<Socket>(async (resolve, reject) => {
      let channel: SimplePeerInstance

      if (this._useOwnStunServers) {
        channel = new Peer({
          wrtc,
          initiator: true,
          trickle: true,
          config: { iceServers: this.stunServers },
        })
      } else {
        channel = new Peer({
          wrtc,
          initiator: true,
          trickle: true,
        })
      }

      const done = async (err?: Error) => {
        channel.removeListener('connect', onConnect)
        channel.removeListener('error', onError)
        channel.removeListener('signal', onSignal)

        if (this._timeoutIntentionallyOnWebRTC !== undefined) {
          await this._timeoutIntentionallyOnWebRTC
        }

        options.signal?.removeEventListener('abort', onAbort)

        if (!err && !this._failIntentionallyOnWebRTC) {
          setImmediate(resolve, (channel as unknown) as Socket)
        }
      }

      const onAbort = () => {
        channel.destroy()

        setImmediate(reject)
      }

      const onSignal = (data: string): void => {
        if (!options.signal?.aborted) {
          console.log('sending', data)
          sinkBuffer.push(this._encoder.encode(JSON.stringify(data)))
        }
      }

      const onConnect = async (): Promise<void> => {
        log(`WebRTC connection with ${counterparty.toB58String()} was successful`)
        done()
      }

      const onError = (err?: Error) => {
        log(`WebRTC with peer ${counterparty.toB58String()} failed. Error was: ${err}`)
        done(err)
      }

      if (options.signal?.aborted) {
        return reject(new AbortError())
      }

      channel.on('signal', onSignal)

      channel.once('error', onError)

      channel.once('connect', onConnect)

      options.signal?.addEventListener('abort', onAbort)

      await pipe(
        /* prettier-ignore */
        srcBuffer,
        async (source: AsyncIterable<Uint8Array>) => {
          for await (const msg of source) {
            console.log('received message', msg)

            if (msg != null) {
              channel.signal(JSON.parse(this._decoder.decode(msg.slice())))
            }
          }
        }
      )
    })
  }

  async dialWithRelay(ma: Multiaddr, relays: PeerInfo[], options?: DialOptions): Promise<Connection> {
    const destination = PeerId.createFromCID(ma.getPeerId())

    if (options.signal?.aborted) {
      throw new AbortError()
    }

    let [relayConnection, index] = await Promise.race(
      relays.map(
        async (relay: PeerInfo, index: number): Promise<[Connection, number]> => {
          let relayConnection = this._registrar.getConnection(relay)

          if (!relayConnection) {
            relayConnection = await this._dialer.connectToPeer(relay, { signal: options?.signal })
          }

          return [relayConnection, index]
        }
      )
    )

    if (!relayConnection) {
      throw Error(
        `Unable to establish a connection to any known relay node. Tried ${chalk.yellow(
          relays.map((relay: PeerInfo) => relay.id.toB58String()).join(`, `)
        )}`
      )
    }

    if (options.signal?.aborted) {
      try {
        await relayConnection.close()
      } catch (err) {
        error(err)
      }
      throw new AbortError()
    }

    let { stream } = await relayConnection.newStream([RELAY_REGISTER])

    const shaker = handshake(stream)

    shaker.write(destination.pubKey.marshal())

    let answer = (await shaker.read())?.slice()

    shaker.rest()

    if (answer == null || !u8aEquals(answer, OK)) {
      throw Error(
        `Could not establish relayed connection to ${chalk.blue(destination.toB58String())} over relay ${relays[
          index
        ].id.toB58String()}`
      )
    }

    let conn: Connection

    if (options.signal?.aborted) {
      try {
        await relayConnection.close()
      } catch (err) {
        error(err)
      }
      throw new AbortError()
    }

    if (this._useWebRTC) {
      const sinkBuffer = pushable<Uint8Array>()
      const srcBuffer = pushable<Uint8Array>()

      const stream = myHandshake(shaker.stream, sinkBuffer, srcBuffer, { signal: options.signal })

      if (options.signal?.aborted) {
        try {
          await relayConnection.close()
        } catch (err) {
          error(err)
        }
        throw new AbortError()
      }

      try {
        const timeout = setTimeout(() => {
          srcBuffer.end()
          sinkBuffer.end()
        }, WEBRTC_TIMEOUT)

        try {
          pipe(shaker.stream, stream.webRtcStream)
          pipe(stream.webRtcStream, shaker.stream)

          console.log(`after piping send streams`)
          let socket = await this.tryWebRTC(srcBuffer, sinkBuffer, destination, { signal: options.signal })

          clearTimeout(timeout)
          srcBuffer.end()
          sinkBuffer.end()

          conn = await this._upgrader.upgradeOutbound(
            socketToConn(socket, {
              signal: options.signal,
              remoteAddr: Multiaddr(`/p2p/${destination.toB58String()}`),
              localAddr: Multiaddr(`/p2p/${this._peerInfo.id.toB58String()}`),
            })
          )
        } catch {
          clearTimeout(timeout)
          srcBuffer.end()
          sinkBuffer.end()

          conn = await this._upgrader.upgradeOutbound(
            this.relayToConn({
              stream: stream.relayStream,
              counterparty: destination,
              connection: relayConnection,
            })
          )
        }
      } catch (err) {
        error(err)
        return
      }
    } else {
      const relayConn = {
        stream: myHandshake(shaker.stream, undefined, undefined, { signal: options.signal }).relayStream,
        counterparty: destination,
        connection: relayConnection,
      }

      if (options.signal?.aborted) {
        try {
          await relayConnection.close()
        } catch (err) {
          error(err)
        }
        throw new AbortError()
      }

      try {
        conn = await this._upgrader.upgradeOutbound(this.relayToConn(relayConn))
      } catch (err) {
        error(err)
        throw err
      }
    }

    return conn
  }

  async dialDirectly(ma: Multiaddr, options?: DialOptions): Promise<Connection> {
    log(`[${chalk.blue(this._peerInfo.id.toB58String())}] dailing ${chalk.yellow(ma.toString())} directly`)
    const socket = await this._connect(ma, options)
    const maConn = socketToConn(socket, { remoteAddr: ma, signal: options.signal })

    log('new outbound connection %s', maConn.remoteAddr)
    const conn = await this._upgrader.upgradeOutbound(maConn)

    log('outbound connection %s upgraded', maConn.remoteAddr)
    return conn
  }

  /**
   * @private
   * @param {Multiaddr} ma
   * @param {object} options
   * @param {AbortSignal} options.signal Used to abort dial requests
   * @returns {Promise<Socket>} Resolves a TCP Socket
   */
  _connect(ma: Multiaddr, options: DialOptions): Promise<Socket> {
    if (options.signal && options.signal.aborted) {
      throw new AbortError()
    }

    return new Promise<Socket>((resolve, reject) => {
      const start = Date.now()
      const cOpts = multiaddrToNetConfig(ma) as any

      log('dialing %j', cOpts)
      const rawSocket = net.connect(cOpts)

      const onError = (err: Error) => {
        err.message = `connection error ${cOpts.host}:${cOpts.port}: ${err.message}`
        done(err)
      }

      const onTimeout = () => {
        log('connnection timeout %s:%s', cOpts.host, cOpts.port)
        const err = errCode(new Error(`connection timeout after ${Date.now() - start}ms`), 'ERR_CONNECT_TIMEOUT')
        // Note: this will result in onError() being called
        rawSocket.emit('error', err)
      }

      const onConnect = () => {
        log('connection opened %j', cOpts)
        done()
      }

      const onAbort = () => {
        log('connection aborted %j', cOpts)
        rawSocket.destroy()
        done(new AbortError())
      }

      const done = (err?: Error) => {
        rawSocket.removeListener('error', onError)
        rawSocket.removeListener('timeout', onTimeout)
        rawSocket.removeListener('connect', onConnect)
        options.signal?.removeEventListener('abort', onAbort)

        if (err) {
          return reject(err)
        }
        resolve(rawSocket)
      }

      rawSocket.on('error', onError)
      rawSocket.on('timeout', onTimeout)
      rawSocket.on('connect', onConnect)
      options.signal?.addEventListener('abort', onAbort)
    })
  }

  /**
   * Creates a TCP listener. The provided `handler` function will be called
   * anytime a new incoming Connection has been successfully upgraded via
   * `upgrader.upgradeInbound`.
   * @param {*} [options]
   * @param {function(Connection)} handler
   * @returns {Listener} A TCP listener
   */
  createListener(options: any, handler: (connection: any) => void): Listener {
    if (typeof options === 'function') {
      handler = options
      options = {}
    }
    options = options || {}

    this.connHandler = handler

    return createListener({ handler, upgrader: this._upgrader }, options)
  }

  /**
   * Takes a list of `Multiaddr`s and returns only valid TCP addresses
   * @param multiaddrs
   * @returns Valid TCP multiaddrs
   */
  filter(multiaddrs: Multiaddr[]): Multiaddr[] {
    multiaddrs = Array.isArray(multiaddrs) ? multiaddrs : [multiaddrs]

    return multiaddrs.filter((ma: Multiaddr) => {
      return mafmt.TCP.matches(ma.decapsulateCode(CODE_P2P)) || mafmt.P2P.matches(ma)
    })
  }
}

export default TCP
