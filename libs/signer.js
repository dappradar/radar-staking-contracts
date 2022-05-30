const { utils } = require('ethers')
const { ecsign } = require('ethereumjs-util')

const { keccak256, solidityPack, formatBytes32String, arrayify } = utils

module.exports = (
  privateKey,
  data
) => {
  const { action, amount } = data;
  const msg = keccak256(
    solidityPack(
      ['bytes32', 'bytes32'],
      [arrayify(formatBytes32String(action)), keccak256(formatBytes32String(amount))]
    )
  )
  const { v, r, s } = ecsign(
    Buffer.from(msg.slice(2), 'hex'),
    Buffer.from(privateKey, 'hex'),
  )

  return '0x' + r.toString('hex') + s.toString('hex') + v.toString(16)
}
