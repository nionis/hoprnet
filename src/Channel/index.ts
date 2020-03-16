import { HoprCoreConnectorInstance } from '@hoprnet/hopr-core-connector-interface'
import ChannelStatic from '@hoprnet/hopr-core-connector-interface/src/channel'
import { ChannelInstance } from '@hoprnet/hopr-core-connector-interface'
import BN from 'bn.js'
import { typedClass } from '../tsc/utils'
import {
  SignedChannel,
  Moment,
  Hash,
  AccountId,
  ChannelId,
  Balance,
  ChannelBalance,
  Ticket,
  State,
  Channel as ChannelType
} from '../types'
import { ChannelStatus } from '../types/Channel'
import { HASH_LENGTH } from '../constants'
import { u8aToHex, u8aXOR, toU8a, stringToU8a, u8aEquals } from '../core/u8a'
import { waitForConfirmation } from '../utils'
import { HoprChannels as IHoprChannels } from '../tsc/web3/HoprChannels'
import HoprEthereum from '..'

declare namespace NChannel {
  interface Static extends ChannelStatic<HoprCoreConnectorInstance> {
    new (...props: any[]): Instance
  }
  interface Instance extends ChannelInstance {}
}

type IChannel = {
  deposit: string
  partyABalance: string
  closureTime: string
  stateCounter: string
}

const getChannel = (hoprEthereum: HoprEthereum, channelId: Hash) => {
  return new Promise<IChannel>(async (resolve, reject) => {
    try {
      const response = await hoprEthereum.hoprChannels.methods.channels(channelId.toHex()).call()
      return resolve(response)
    } catch (error) {
      return reject(error)
    }
  })
}

const onceOpen = (hoprEthereum: HoprEthereum, channelId: Hash): Promise<void> => {
  let event: ReturnType<IHoprChannels['events']['OpenedChannel']>

  return new Promise<void>((resolve, reject) => {
    // TODO: better to filter
    event = hoprEthereum.hoprChannels.events
      .OpenedChannel()
      .on('data', async data => {
        const { opener, counterParty } = data.returnValues
        const _channelId = await hoprEthereum.utils.getId(stringToU8a(opener), stringToU8a(counterParty))

        if (!u8aEquals(_channelId, channelId)) {
          return
        }

        resolve()
      })
      .on('error', error => {
        reject(error)
      })
  }).finally(() => {
    event.removeAllListeners()
  })
}

const onceClosed = (hoprEthereum: HoprEthereum, channelId: Hash): Promise<void> => {
  let event: ReturnType<IHoprChannels['events']['ClosedChannel']>

  return new Promise<void>((resolve, reject) => {
    // TODO: better to filter
    event = hoprEthereum.hoprChannels.events
      .ClosedChannel()
      .on('data', async data => {
        console.log('ClosedChannel()', data.returnValues)
        const { closer, counterParty } = data.returnValues
        const _channelId = await hoprEthereum.utils.getId(stringToU8a(closer), stringToU8a(counterParty))

        if (!u8aEquals(_channelId, channelId)) {
          return
        }

        resolve()
      })
      .on('error', error => {
        reject(error)
      })
  }).finally(() => {
    event.removeAllListeners()
  })
}

const onceFundedByCounterparty = (
  hoprEthereum: HoprEthereum,
  channelId: Hash,
  counterparty: AccountId
): Promise<void> => {
  let event: ReturnType<IHoprChannels['events']['FundedChannel']>

  return new Promise<void>((resolve, reject) => {
    // TODO: better to filter
    event = hoprEthereum.hoprChannels.events
      .FundedChannel()
      .on('data', async data => {
        console.log('FundedChannel()', data.returnValues)
        const { recipient, counterParty: _counterparty } = data.returnValues
        const _channelId = await hoprEthereum.utils.getId(stringToU8a(recipient), stringToU8a(_counterparty))

        if (!u8aEquals(_channelId, channelId)) {
          return
        }
        if (!u8aEquals(stringToU8a(_counterparty), counterparty)) {
          return
        }

        resolve()
      })
      .on('error', error => {
        reject(error)
      })
  }).finally(() => {
    event.removeAllListeners()
  })
}

@typedClass<NChannel.Static>()
class Channel {
  private _signedChannel: SignedChannel
  private _settlementWindow?: Moment
  private _channelId?: Hash

  constructor(public hoprEthereum: HoprEthereum, public counterparty: Uint8Array, signedChannel: SignedChannel) {
    this._signedChannel = signedChannel
  }

  private async onceOpen(): Promise<void> {
    return onceOpen(this.hoprEthereum, await this.channelId)
  }

  private async onceClosed(): Promise<void> {
    return onceClosed(this.hoprEthereum, await this.channelId)
  }

  private get channel() {
    return new Promise<IChannel>(async (resolve, reject) => {
      try {
        const response = await getChannel(this.hoprEthereum, await this.channelId)
        return resolve(response)
      } catch (error) {
        return reject(error)
      }
    })
  }

  ticket = Ticket

  get offChainCounterparty(): Uint8Array {
    return this._signedChannel.signer
  }

  get channelId() {
    return new Promise<Hash>(async (resolve, reject) => {
      if (this._channelId != null) {
        return resolve(this._channelId)
      }

      try {
        const channelId = await this.hoprEthereum.utils.getId(
          this.hoprEthereum.account,
          await this.hoprEthereum.utils.pubKeyToAccountId(this.counterparty)
        )
        this._channelId = new ChannelId(channelId)
      } catch (error) {
        return reject(error)
      }

      return resolve(this._channelId)
    })
  }

  get settlementWindow() {
    return new Promise<Moment>(async (resolve, reject) => {
      if (this._settlementWindow != null) {
        return resolve(this._settlementWindow)
      }

      try {
        const channel = await this.channel
        this._settlementWindow = new Moment(channel.closureTime)
      } catch (error) {
        return reject(error)
      }

      return resolve(this._settlementWindow)
    })
  }

  get state() {
    return new Promise<State>(async (resolve, reject) => {
      try {
        const channel = await this.channel
        return resolve(new State(Number(channel.stateCounter)))
      } catch (error) {
        return reject(error)
      }
    })
  }

  get balance() {
    return new Promise<Balance>(async (resolve, reject) => {
      try {
        const channel = await this.channel
        return resolve(new Balance(channel.deposit))
      } catch (error) {
        return reject(error)
      }
    })
  }

  get balance_a() {
    return new Promise<Balance>(async (resolve, reject) => {
      try {
        const channel = await this.channel
        return resolve(new Balance(channel.partyABalance))
      } catch (error) {
        return reject(error)
      }
    })
  }

  get currentBalance() {
    return new Promise<Balance>(async (resolve, reject) => {
      try {
        const response = await this.hoprEthereum.hoprToken.methods.balanceOf(u8aToHex(this.hoprEthereum.account)).call()
        return resolve(new Balance(response))
      } catch (error) {
        return reject(error)
      }
    })
  }

  get currentBalanceOfCounterparty() {
    return new Promise<Balance>(async (resolve, reject) => {
      try {
        const response = await this.hoprEthereum.hoprToken.methods
          .balanceOf(u8aToHex(await this.hoprEthereum.utils.pubKeyToAccountId(this.counterparty)))
          .call()
        return resolve(new Balance(response))
      } catch (error) {
        return reject(error)
      }
    })
  }

  async initiateSettlement(): Promise<void> {
    try {
      const channel = await this.channel

      if (Number(channel.stateCounter) % 10 === ChannelStatus.PENDING) {
        await this.onceClosed()
      } else {
        await Promise.all([
          this.onceClosed(),
          this.hoprEthereum.hoprChannels.methods
            .initiateChannelClosure(u8aToHex(await this.hoprEthereum.utils.pubKeyToAccountId(this.counterparty)))
            .send({
              from: this.hoprEthereum.account.toHex()
            })
        ])
      }
    } catch (error) {
      throw error
    }
  }

  async getPreviousChallenges(): Promise<Hash> {
    let pubKeys: Uint8Array[] = []
    const challenge = new Uint8Array(HASH_LENGTH).fill(0x00)

    return new Promise<Hash>(async (resolve, reject) => {
      this.hoprEthereum.db
        .createReadStream({
          gt: Buffer.from(this.hoprEthereum.dbKeys.Challenge(await this.channelId, challenge)),
          lt: Buffer.from(this.hoprEthereum.dbKeys.Challenge(await this.channelId, challenge))
        })
        .on('error', reject)
        .on('data', ({ key, ownKeyHalf }) => {
          const [channelId, challenge] = this.hoprEthereum.dbKeys.ChallengeKeyParse(key)

          // BIG TODO !!
          // replace this by proper EC-arithmetic
          pubKeys.push(new Uint8Array(u8aXOR(false, challenge, ownKeyHalf.toU8a())))
        })
        .on('end', () => {
          if (pubKeys.length > 0) {
            return resolve(new Hash(u8aXOR(false, ...pubKeys)))
          }

          resolve()
        })
    })
  }

  static async isOpen(hoprEthereum: HoprEthereum, counterpartyPubKey: Uint8Array, channelId: Hash) {
    const [onChain, offChain]: [boolean, boolean] = await Promise.all([
      getChannel(hoprEthereum, channelId).then(channel => {
        console.log('isOpen', channel)
        const state = Number(channel.stateCounter) % 10
        return state === ChannelStatus.OPEN || state === ChannelStatus.PENDING
      }),
      hoprEthereum.db.get(Buffer.from(hoprEthereum.dbKeys.Channel(counterpartyPubKey))).then(
        () => true,
        err => {
          if (err.notFound) {
            return false
          } else {
            throw err
          }
        }
      )
    ])

    if (onChain != offChain) {
      if (!onChain && offChain) {
        throw Error(`Channel ${u8aToHex(channelId)} exists off-chain but not on-chain.`)
      } else {
        throw Error(`Channel ${u8aToHex(channelId)} exists on-chain but not off-chain.`)
      }
    }

    return onChain && offChain
  }

  static async increaseFunds(hoprEthereum: HoprEthereum, counterparty: AccountId, amount: Balance): Promise<void> {
    try {
      if ((await hoprEthereum.accountBalance).lt(amount)) {
        throw Error('Insufficient funds.')
      }

      await waitForConfirmation(
        hoprEthereum.hoprChannels.methods
          .fundChannel(hoprEthereum.account.toHex(), counterparty.toHex(), amount.toString())
          .send({
            from: hoprEthereum.account.toHex(),
            gas: '500000'
          })
      )
    } catch (error) {
      throw error
    }
  }

  static async create(
    hoprEthereum: HoprEthereum,
    counterpartyPubKey: Uint8Array,
    _getOnChainPublicKey: (counterparty: Uint8Array) => Promise<Uint8Array>,
    channelBalance?: ChannelBalance,
    _sign?: (channelBalance: ChannelBalance) => Promise<SignedChannel>
  ): Promise<Channel> {
    let signedChannel: SignedChannel

    const counterparty = new AccountId(await hoprEthereum.utils.pubKeyToAccountId(counterpartyPubKey))

    // const counterparty = await getOnChainPublicKey(offChainCounterparty).then(v => new AccountId(v))
    const channelId = new Hash(await hoprEthereum.utils.getId(hoprEthereum.account, counterparty))
    let channel: Channel

    if (await this.isOpen(hoprEthereum, counterpartyPubKey, channelId)) {
      console.log('is open')
      const record = await hoprEthereum.db.get(Buffer.from(hoprEthereum.dbKeys.Channel(counterpartyPubKey)))
      signedChannel = new SignedChannel({
        bytes: record.buffer,
        offset: record.byteOffset
      })
      channel = new Channel(hoprEthereum, counterpartyPubKey, signedChannel)
    } else if (_sign != null && channelBalance != null) {
      console.log('is not open')
      const spender = hoprEthereum.hoprChannels.options.address

      let amount: Balance
      if (hoprEthereum.utils.isPartyA(hoprEthereum.account, counterparty)) {
        amount = channelBalance.balance_a
      } else {
        amount = new Balance(channelBalance.balance.sub(channelBalance.balance_a))
      }

      const allowance = await hoprEthereum.hoprToken.methods
        .allowance(hoprEthereum.account.toHex(), spender)
        .call()
        .then(v => new BN(v))

      if (allowance.isZero()) {
        console.log('approving x')
        await waitForConfirmation(
          hoprEthereum.hoprToken.methods.approve(spender, amount.toString()).send({
            from: hoprEthereum.account.toHex()
          })
        )
      } else if (allowance.lt(amount)) {
        console.log('increasing allowance')
        await waitForConfirmation(
          hoprEthereum.hoprToken.methods.increaseAllowance(spender, amount.sub(allowance).toString()).send({
            from: hoprEthereum.account.toHex()
          })
        )
      }

      console.log('increase funds')
      await Channel.increaseFunds(hoprEthereum, counterparty, amount)

      signedChannel = await SignedChannel.create(hoprEthereum, ChannelType.createActive(channelBalance))
      channel = new Channel(hoprEthereum, counterpartyPubKey, signedChannel)

      await onceFundedByCounterparty(hoprEthereum, channelId, counterparty)

      console.log('opening')
      await waitForConfirmation(
        hoprEthereum.hoprChannels.methods.openChannel(counterparty.toHex()).send({
          from: hoprEthereum.account.toHex()
        })
      )

      await hoprEthereum.db.put(
        Buffer.from(hoprEthereum.dbKeys.Channel(counterpartyPubKey)),
        Buffer.from(signedChannel)
      )
    } else {
      throw Error('Invalid input parameters.')
    }

    return channel
  }

  static getAll<T, R>(
    hoprEthereum: HoprEthereum,
    onData: (channel: Channel) => Promise<T>,
    onEnd: (promises: Promise<T>[]) => R
  ): Promise<R> {
    const promises: Promise<T>[] = []
    return new Promise<R>((resolve, reject) => {
      hoprEthereum.db
        .createReadStream({
          gt: Buffer.from(hoprEthereum.dbKeys.Channel(new Uint8Array(Hash.SIZE).fill(0x00))),
          lt: Buffer.from(hoprEthereum.dbKeys.Channel(new Uint8Array(Hash.SIZE).fill(0xff)))
        })
        .on('error', err => reject(err))
        .on('data', ({ key, value }: { key: Buffer; value: Buffer }) => {
          const signedChannel = new SignedChannel({
            bytes: value.buffer,
            offset: value.byteOffset
          })

          // console.log(signedChannel)
          // console.log(signedChannel.signature)
          // console.log(signedChannel.signature.signature)
          // console.log(signedChannel.signature.length)

          promises.push(onData(new Channel(hoprEthereum, hoprEthereum.dbKeys.ChannelKeyParse(key), signedChannel)))
        })
        .on('end', () => resolve(onEnd(promises)))
    })
  }

  static async closeChannels(hoprEthereum: HoprEthereum): Promise<Balance> {
    const result = new BN(0)

    return Channel.getAll(
      hoprEthereum,
      (channel: Channel) =>
        channel.initiateSettlement().then(() => {
          // TODO: add balance
          result.iaddn(0)
        }),
      async (promises: Promise<void>[]) => {
        await Promise.all(promises)

        return new Balance(result)
      }
    )
  }

  async testAndSetNonce(signature: Uint8Array): Promise<void> {
    const key = this.hoprEthereum.dbKeys.Nonce(await this.channelId, toU8a(await this.hoprEthereum.nonce))

    try {
      await this.hoprEthereum.db.get(u8aToHex(key))
    } catch (err) {
      if (err.notFound == null || err.notFound != true) {
        throw err
      }
      return
    }

    throw Error('Nonces must not be used twice.')
  }

  static handleOpeningRequest(
    hoprEthereum: HoprEthereum
  ): (source: AsyncIterable<Uint8Array>) => AsyncIterator<Uint8Array> {
    return source => {
      return (async function*(msgs) {
        for await (const _msg of msgs) {
          console.log('msg', _msg)

          const msg = _msg.slice()
          const signedChannel = new SignedChannel({
            bytes: msg.buffer,
            offset: msg.byteOffset
          })

          const counterparty = signedChannel.signer
          const channelBalance = signedChannel.channel.balance
          const channelId = await hoprEthereum.utils.getId(hoprEthereum.account, counterparty)

          await onceOpen(hoprEthereum, new Hash(channelId))

          if (hoprEthereum.utils.isPartyA(hoprEthereum.account, counterparty)) {
            await Channel.increaseFunds(hoprEthereum, counterparty, channelBalance.balance_a)
          } else {
            await Channel.increaseFunds(
              hoprEthereum,
              counterparty,
              new Balance(channelBalance.balance.sub(channelBalance.balance_a))
            )

            await hoprEthereum.db.put(
              Buffer.from(u8aToHex(hoprEthereum.dbKeys.Channel(counterparty))),
              Buffer.from(signedChannel)
            )
          }

          yield signedChannel.toU8a()
        }
      })(source)
    }
  }
}

export default Channel
